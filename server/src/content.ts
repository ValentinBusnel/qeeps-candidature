import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Profile, Project, Settings } from "./models.js";
import { UPLOAD_DIR } from "./uploads.js";

/**
 * Contenu embarqué pour la mise en ligne.
 *
 * `server/content/` contient l'état du site au moment du déploiement :
 *  - `content.json` : profil, projets et réglages (sans messages ni comptes) ;
 *  - `uploads/`     : les fichiers réellement utilisés par le site (vidéos, PDF, images).
 *
 * Au premier démarrage en production (base vide), le site est recréé à l'identique à partir
 * de ces fichiers, et les fichiers manquants sont copiés sur le disque persistant.
 * Ensuite, tout se modifie normalement depuis l'admin : ces fichiers ne servent plus.
 */
export const CONTENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../content");
const CONTENT_FILE = path.join(CONTENT_DIR, "content.json");
const BUNDLED_UPLOADS = path.join(CONTENT_DIR, "uploads");

type Obj = Record<string, unknown>;
type Bundle = { profile: Obj; projects: Obj[]; settings?: Obj };

/** Base vide + contenu embarqué présent : on recrée le site tel qu'il était. */
export async function importBundledContent(migrations: string[]): Promise<boolean> {
  if (!existsSync(CONTENT_FILE)) return false;
  if (await Profile.exists({})) return false;
  const bundle = JSON.parse(await fs.readFile(CONTENT_FILE, "utf8")) as Bundle;
  const clean = <T extends Obj>(o: T) => {
    const { _id, __v, createdAt, updatedAt, ...rest } = o;
    void _id, void __v, void createdAt, void updatedAt;
    return rest;
  };
  await Profile.create(clean(bundle.profile));
  if (bundle.projects?.length) await Project.insertMany(bundle.projects.map(clean));
  await Settings.deleteMany({});
  // le contenu embarqué est déjà à jour : aucune modification ponctuelle à rejouer
  await Settings.create({ colors: (bundle.settings?.colors as Obj) ?? {}, migrations });
  console.log(`📦 Contenu embarqué importé (${bundle.projects?.length ?? 0} projets)`);
  return true;
}

/** Copie sur le disque persistant les fichiers embarqués qui n'y sont pas encore. */
export async function syncBundledUploads() {
  if (!existsSync(BUNDLED_UPLOADS) || path.resolve(BUNDLED_UPLOADS) === path.resolve(UPLOAD_DIR)) return;
  let copied = 0;
  const walk = async (dir: string) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const from = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(from);
        continue;
      }
      const to = path.join(UPLOAD_DIR, path.relative(BUNDLED_UPLOADS, from));
      if (existsSync(to)) continue;
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(from, to);
      copied++;
    }
  };
  await walk(BUNDLED_UPLOADS);
  if (copied) console.log(`📦 ${copied} fichier(s) embarqué(s) copié(s) dans ${UPLOAD_DIR}`);
}

/**
 * Exporte l'état actuel du site dans server/content (à lancer avant une mise en ligne) :
 * `npm run content:export`, ou au démarrage du serveur si le fichier server/content/.export existe.
 */
export async function exportContent() {
  const profile = await Profile.findOne().lean<Obj>();
  if (!profile) throw new Error("Aucun profil en base : rien à exporter");
  const projects = await Project.find().sort({ order: 1 }).lean<Obj[]>();
  const settings = await Settings.findOne().lean<Obj>();
  const bundle = { profile, projects, settings: { colors: settings?.colors ?? {} } };

  // fichiers réellement utilisés par le site (les autres restent sur ton ordinateur)
  const used = [...new Set(JSON.stringify(bundle).match(/\/uploads\/[^"\\?#]+/g) ?? [])];
  await fs.rm(BUNDLED_UPLOADS, { recursive: true, force: true });
  let copied = 0;
  for (const url of used) {
    const rel = decodeURIComponent(url.replace(/^\/uploads\//, ""));
    const from = path.join(UPLOAD_DIR, rel);
    if (!existsSync(from)) {
      console.warn(`⚠️  Fichier introuvable, ignoré : ${url}`);
      continue;
    }
    const to = path.join(BUNDLED_UPLOADS, rel);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(from, to);
    copied++;
  }
  await fs.mkdir(CONTENT_DIR, { recursive: true });
  await fs.writeFile(CONTENT_FILE, JSON.stringify(bundle, null, 2) + "\n");
  console.log(`📦 Contenu exporté dans server/content (${projects.length} projets, ${copied} fichiers)`);
}

/** Export demandé par un fichier déclencheur (server/content/.export), puis supprimé. */
export async function exportIfRequested() {
  const trigger = path.join(CONTENT_DIR, ".export");
  if (!existsSync(trigger)) return;
  await fs.rm(trigger, { force: true });
  await exportContent();
}

// Exécution directe : `npm run content:export`
if (process.argv[1]?.endsWith("content.ts") || process.argv[1]?.endsWith("content.js")) {
  const { connectDb } = await import("./db.js");
  const mongoose = (await import("mongoose")).default;
  await import("dotenv/config");
  const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/qeeps-candidature";
  if (!(await connectDb(uri))) process.exit(1);
  await exportContent();
  await mongoose.disconnect();
}
