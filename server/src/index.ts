import "dotenv/config";
import { createApp } from "./app.js";
import { connectDb } from "./db.js";
import { ensureAdmin, ensureContent, runMigrations } from "./seed.js";
import { exportIfRequested, syncBundledUploads } from "./content.js";

const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/qeeps-candidature";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

// fichiers embarqués (vidéos, PDF…) recopiés sur le disque persistant s'ils n'y sont pas
await syncBundledUploads().catch((e) => console.warn("⚠️  Copie des fichiers embarqués impossible :", e));

if (await connectDb(MONGODB_URI)) {
  await ensureContent();
  await runMigrations();
  await ensureAdmin();
  await exportIfRequested().catch((e) => console.warn("⚠️  Export du contenu impossible :", e));
}

createApp(CLIENT_ORIGIN).listen(PORT, () => {
  console.log(`🚀 Serveur prêt sur le port ${PORT}`);
});
