import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

/** Dossier où sont stockés les fichiers envoyés depuis l'admin (servi sur /uploads). */
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR) // en production : le disque persistant (volume Railway)
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

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Enregistre un fichier et renvoie son URL publique. Le nom est nettoyé et rendu unique. */
export async function saveUpload(body: Buffer, mime: string, originalName: string, folder: string) {
  const ext = ALLOWED_TYPES[mime];
  if (!ext) throw new Error("Type de fichier non autorisé");
  // un SVG peut contenir du code : on n'accepte que des dessins (logos)
  if (ext === ".svg" && /<script|<foreignObject|\son[a-z]+\s*=|javascript:|<iframe|<embed|<object/i.test(body.toString("utf8"))) {
    throw new Error("Ce SVG contient du code : seuls les dessins sont acceptés");
  }
  const safeFolder = slugify(folder) || "divers";
  const base = slugify(path.parse(originalName).name) || "fichier";
  const name = `${base}-${crypto.randomBytes(3).toString("hex")}${ext}`;
  const dir = path.join(UPLOAD_DIR, safeFolder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), body);
  return { url: `/uploads/${safeFolder}/${name}`, size: body.length, type: mime };
}

const MEDIA_EXT = new Set(Object.values(ALLOWED_TYPES).concat([".jpeg"]));

/**
 * Tous les fichiers médias (images, vidéos, PDF) du dossier d'uploads, sous-dossiers compris
 * (ex. projets-anasawi/web/mobile.mp4). Le « dossier » affiché est le premier niveau ;
 * les fichiers de travail (scripts, journaux, images intermédiaires « frames ») sont ignorés.
 */
export async function listUploads() {
  const out: { url: string; size: number; folder: string; name: string; modified: string }[] = [];
  async function walk(rel: string) {
    let entries: import("node:fs").Dirent[] = [];
    try {
      entries = await fs.readdir(path.join(UPLOAD_DIR, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (e.name !== "frames") await walk(child);
        continue;
      }
      if (!rel || !e.isFile() || !MEDIA_EXT.has(path.extname(e.name).toLowerCase())) continue;
      const st = await fs.stat(path.join(UPLOAD_DIR, child));
      out.push({ url: `/uploads/${child}`, size: st.size, folder: child.split("/")[0], name: e.name, modified: st.mtime.toISOString() });
    }
  }
  await walk("");
  return out.sort((a, b) => a.folder.localeCompare(b.folder) || b.modified.localeCompare(a.modified));
}

/** Supprime un fichier d'upload ; refuse tout chemin qui sortirait du dossier. */
export async function deleteUpload(url: string) {
  if (!url.startsWith("/uploads/")) throw new Error("Chemin invalide");
  const target = path.resolve(UPLOAD_DIR, url.slice("/uploads/".length));
  if (!target.startsWith(UPLOAD_DIR + path.sep)) throw new Error("Chemin invalide");
  await fs.unlink(target);
}
