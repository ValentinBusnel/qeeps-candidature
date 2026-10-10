import "dotenv/config";
import { createApp } from "./app.js";
import { connectDb } from "./db.js";
import { ensureAdmin, ensureContent, runMigrations } from "./seed.js";
import { BUNDLED_UPLOADS, exportIfRequested } from "./content.js";
import { LEGACY_UPLOAD_DIR, importUsedFiles } from "./uploads.js";

const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/qeeps-candidature";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

if (await connectDb(MONGODB_URI)) {
  await ensureContent();
  await runMigrations();
  await ensureAdmin();
  // fichiers du site : tous dans la base (reprise depuis l'ancien dossier local ou le contenu embarqué)
  await importUsedFiles([LEGACY_UPLOAD_DIR, BUNDLED_UPLOADS]).catch((e) => console.warn("⚠️  Reprise des fichiers impossible :", e));
  await exportIfRequested().catch((e) => console.warn("⚠️  Export du contenu impossible :", e));
}

createApp(CLIENT_ORIGIN).listen(PORT, () => {
  console.log(`🚀 Serveur prêt sur le port ${PORT}`);
});
