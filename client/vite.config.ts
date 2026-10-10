import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * En développement, Safari garde parfois d'anciennes versions des modules en cache
 * (même après ⌘R) : on lui interdit tout cache, sauf pour les gros fichiers (vidéos, pdf.js).
 */
const noStoreInDev = (): Plugin => ({
  name: "no-store-in-dev",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith("/uploads") || req.url?.startsWith("/vendor")) return next();
      const set = res.setHeader.bind(res);
      res.setHeader = ((name: string, value: number | string | readonly string[]) => {
        const key = name.toLowerCase();
        if (key === "etag") return res; // pas de 304 : toujours la version à jour
        return set(name, key === "cache-control" ? "no-store" : value);
      }) as typeof res.setHeader;
      set("Cache-Control", "no-store");
      next();
    });
  }
});

export default defineConfig({
  plugins: [react(), noStoreInDev()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
      "/uploads": "http://localhost:4000"
    }
  }
});
