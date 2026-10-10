import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Profile, Project, Settings } from "./models.js";

/**
 * Fichiers du site (images, vidéos, PDF, logos) : stockés dans MongoDB (GridFS),
 * jamais sur le disque du serveur. Ils sont servis sur /uploads/<dossier>/<nom>.
 *
 * L'ancien dossier local (server/uploads, ou UPLOAD_DIR) ne sert plus qu'une fois :
 * au démarrage, les fichiers réellement utilisés par le site y sont repris dans la base.
 */
export const LEGACY_UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../uploads");

export const ALLOWED_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "application/pdf": ".pdf"
};
const TYPE_OF_EXT: Record<string, string> = Object.fromEntries(Object.entries(ALLOWED_TYPES).map(([t, e]) => [e, t]));
TYPE_OF_EXT[".jpeg"] = "image/jpeg";

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

type FileMeta = { contentType: string; folder: string };
type StoredFile = { _id: mongoose.Types.ObjectId; filename: string; length: number; uploadDate: Date; metadata?: FileMeta };

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "uploads" });

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** « /uploads/a/b.mp4 » → « a/b.mp4 » (refuse tout chemin bizarre). */
export function keyOfUrl(url: string) {
  if (!url.startsWith("/uploads/")) throw new Error("Chemin invalide");
  const key = decodeURIComponent(url.slice("/uploads/".length).split(/[?#]/)[0]);
  if (!key || key.includes("..") || key.startsWith("/")) throw new Error("Chemin invalide");
  return key;
}

const findFile = async (key: string) => (await bucket().find({ filename: key }).sort({ uploadDate: -1 }).limit(1).toArray())[0] as StoredFile | undefined;

/** Écrit un fichier dans la base (remplace une éventuelle version précédente du même nom). */
async function putFile(key: string, body: Buffer, contentType: string) {
  const b = bucket();
  const old = (await b.find({ filename: key }).toArray()) as StoredFile[];
  await new Promise<void>((resolve, reject) => {
    const stream = b.openUploadStream(key, { metadata: { contentType, folder: key.split("/")[0] } satisfies FileMeta });
    stream.once("finish", () => resolve());
    stream.once("error", reject);
    stream.end(body);
  });
  for (const f of old) await b.delete(f._id).catch(() => {});
}

/** Enregistre un fichier envoyé depuis l'admin et renvoie son URL publique. */
export async function saveUpload(body: Buffer, mime: string, originalName: string, folder: string) {
  const ext = ALLOWED_TYPES[mime];
  if (!ext) throw new Error("Type de fichier non autorisé");
  // un SVG peut contenir du code : on n'accepte que des dessins (logos)
  if (ext === ".svg" && /<script|<foreignObject|\son[a-z]+\s*=|javascript:|<iframe|<embed|<object/i.test(body.toString("utf8"))) {
    throw new Error("Ce SVG contient du code : seuls les dessins sont acceptés");
  }
  const safeFolder = slugify(folder) || "divers";
  const base = slugify(path.parse(originalName).name) || "fichier";
  const key = `${safeFolder}/${base}-${crypto.randomBytes(3).toString("hex")}${ext}`;
  await putFile(key, body, mime);
  return { url: `/uploads/${key}`, size: body.length, type: mime };
}

/** Adresses /uploads/… utilisées par le contenu du site (profil, projets, réglages). */
export async function usedUploads(): Promise<Set<string>> {
  const [profile, projects, settings] = await Promise.all([Profile.findOne().lean(), Project.find().lean(), Settings.findOne().lean()]);
  const text = JSON.stringify([profile, projects, settings]);
  const set = new Set<string>();
  for (const m of text.match(/\/uploads\/[^"\\?#\s)]+/g) ?? []) {
    try {
      set.add(keyOfUrl(m));
    } catch {
      /* ignoré */
    }
  }
  return set;
}

/** Tous les fichiers de la base, avec l'information « utilisé sur le site ». */
export async function listUploads() {
  const [files, used] = await Promise.all([bucket().find({}).toArray() as Promise<StoredFile[]>, usedUploads()]);
  return files
    .map((f) => ({
      url: `/uploads/${f.filename}`,
      size: f.length,
      folder: f.filename.split("/")[0],
      name: f.filename.split("/").pop() ?? f.filename,
      modified: f.uploadDate.toISOString(),
      used: used.has(f.filename)
    }))
    .sort((a, b) => a.folder.localeCompare(b.folder) || b.modified.localeCompare(a.modified));
}

export async function deleteUpload(url: string) {
  const key = keyOfUrl(url);
  const files = (await bucket().find({ filename: key }).toArray()) as StoredFile[];
  if (!files.length) throw Object.assign(new Error("Fichier introuvable"), { code: "ENOENT" });
  for (const f of files) await bucket().delete(f._id);
}

/** Supprime tous les fichiers qui ne sont plus utilisés nulle part sur le site. */
export async function deleteUnusedUploads() {
  const [files, used] = await Promise.all([bucket().find({}).toArray() as Promise<StoredFile[]>, usedUploads()]);
  let count = 0;
  let bytes = 0;
  for (const f of files) {
    if (used.has(f.filename)) continue;
    await bucket().delete(f._id);
    count++;
    bytes += f.length;
  }
  return { count, bytes };
}

/** Sert un fichier depuis la base, avec les requêtes partielles (indispensables aux vidéos sur Safari). */
export async function serveUpload(req: Request, res: Response) {
  let key: string;
  try {
    key = keyOfUrl(req.originalUrl);
  } catch {
    return res.status(400).end();
  }
  const file = await findFile(key);
  if (!file) return res.status(404).end();
  const type = file.metadata?.contentType ?? TYPE_OF_EXT[path.extname(key).toLowerCase()] ?? "application/octet-stream";
  const etag = `"${file._id.toHexString()}-${file.length}"`;
  res.setHeader("Content-Type", type);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("ETag", etag);
  res.setHeader("Last-Modified", file.uploadDate.toUTCString());
  res.setHeader("Cache-Control", "public, max-age=604800");
  // un SVG ouvert directement ne peut rien exécuter
  if (type === "image/svg+xml") res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  if (req.headers["if-none-match"] === etag) return res.status(304).end();

  let start = 0;
  let end = file.length - 1;
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
  if (range && file.length > 0) {
    if (range[1] === "" && range[2] !== "") {
      start = Math.max(0, file.length - Number(range[2]));
    } else {
      start = Number(range[1] || 0);
      if (range[2] !== "") end = Math.min(end, Number(range[2]));
    }
    if (start > end || start >= file.length) {
      res.setHeader("Content-Range", `bytes */${file.length}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${file.length}`);
  }
  res.setHeader("Content-Length", String(file.length ? end - start + 1 : 0));
  if (req.method === "HEAD" || file.length === 0) return res.end();
  const stream = bucket().openDownloadStream(file._id, { start, end: end + 1 });
  stream.on("error", () => res.destroy());
  req.on("close", () => stream.destroy());
  stream.pipe(res);
}

/** Lit un fichier de la base (export du contenu). */
export async function readUpload(key: string): Promise<Buffer | null> {
  const file = await findFile(key);
  if (!file) return null;
  const chunks: Buffer[] = [];
  for await (const c of bucket().openDownloadStream(file._id)) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

/**
 * Reprise dans la base des fichiers utilisés par le site qui n'y sont pas encore,
 * depuis l'ancien dossier local ou le contenu embarqué (server/content/uploads).
 * Les fichiers inutilisés (essais, captures, doublons) ne sont pas repris.
 */
export async function importUsedFiles(sources: string[]) {
  const used = await usedUploads();
  let imported = 0;
  const missing: string[] = [];
  for (const key of used) {
    if (await findFile(key)) continue;
    const from = sources.map((dir) => path.join(dir, key)).find((p) => existsSync(p));
    if (!from) {
      missing.push(key);
      continue;
    }
    await putFile(key, await fs.readFile(from), TYPE_OF_EXT[path.extname(key).toLowerCase()] ?? "application/octet-stream");
    imported++;
  }
  if (imported) console.log(`🗄️  ${imported} fichier(s) du site repris dans la base de données`);
  if (missing.length) console.warn(`⚠️  Fichiers utilisés mais introuvables : ${missing.join(", ")}`);
}
