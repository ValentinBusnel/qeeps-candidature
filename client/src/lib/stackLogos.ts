import { useSyncExternalStore } from "react";

/**
 * Logos officiels des technologies (devicon + simple-icons, licences MIT / CC0),
 * stockés dans client/public/stack-logos/. Une technologie absente de la liste
 * reçoit un logo par défaut.
 * Pour en ajouter un : déposer <slug>.svg dans public/stack-logos et l'ajouter ici.
 */
const LOGOS: Record<string, string> = {
  react: "react",
  typescript: "typescript",
  ts: "typescript",
  javascript: "javascript",
  js: "javascript",
  nextjs: "nextjs",
  next: "nextjs",
  serveractions: "nextjs",
  nextjsserveractions: "nextjs",
  angular: "angular",
  html: "html5",
  html5: "html5",
  css: "css3",
  css3: "css3",
  tailwind: "tailwindcss",
  tailwindcss: "tailwindcss",
  shadcn: "shadcnui",
  shadcnui: "shadcnui",
  java: "java",
  springboot: "springboot",
  spring: "spring",
  springbatch: "spring",
  postgresql: "postgresql",
  postgres: "postgresql",
  mysql: "mysql",
  snowflake: "snowflake",
  talend: "talend",
  git: "git",
  github: "github",
  vite: "vitejs",
  vitejs: "vitejs",
  zod: "zod",
  playwright: "playwright",
  claude: "claude",
  claudecode: "claude",
  azure: "azure",
  azureblobstorage: "azure",
  python: "python",
  ruby: "ruby",
  rubyonrails: "rails",
  rails: "rails",
  node: "nodejs",
  nodejs: "nodejs",
  express: "express",
  mongodb: "mongodb",
  streamlit: "streamlit",
  powerbi: "powerbi",
  microsoftpowerbi: "powerbi",
  framermotion: "framermotion",
  framer: "framermotion",
  motion: "framermotion",
  drizzle: "drizzle",
  drizzleorm: "drizzle",
  cloudflare: "cloudflare",
  cloudflarer2: "cloudflare",
  r2: "cloudflare",
  vercel: "vercel",
  neon: "postgresql"
};

export const normalizeStack = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 60);

/* ---------- Logos choisis dans l'admin (catalogue ou fichier envoyé) ----------
 * Stockés côté serveur (GET /api/stack-logos), chargés une fois, partagés entre l'admin
 * et son aperçu (BroadcastChannel) pour que l'aperçu se mette à jour aussitôt. */
let custom: Record<string, string> = {};
let loaded = false;
const listeners = new Set<() => void>();
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("stack-logos") : null;

function emit() {
  custom = { ...custom };
  listeners.forEach((l) => l());
}

channel?.addEventListener("message", (e) => {
  if (e.data && typeof e.data === "object") {
    custom = e.data as Record<string, string>;
    emit();
  }
});

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  fetch("/api/stack-logos", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : {}))
    .then((map: Record<string, string>) => {
      custom = { ...map, ...custom };
      emit();
    })
    .catch(() => {});
}

/** Mise à jour locale (après enregistrement côté serveur) : tout le monde la voit aussitôt. */
export function setStackLogos(map: Record<string, string>) {
  custom = { ...map };
  loaded = true;
  emit();
  channel?.postMessage(custom);
}

export function subscribeStackLogos(cb: () => void) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export const getStackLogos = () => custom;

/** URL du logo d'une technologie, ou null s'il n'y en a pas. */
export function stackLogo(name: string): string | null {
  const key = normalizeStack(name);
  if (custom[key]) return custom[key];
  const slug = LOGOS[key];
  return slug ? `/stack-logos/${slug}.svg` : null;
}

/** Même chose, en se mettant à jour quand un logo est ajouté ou chargé. */
export function useStackLogo(name: string): string | null {
  useSyncExternalStore(subscribeStackLogos, getStackLogos, getStackLogos);
  return stackLogo(name);
}
