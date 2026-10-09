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

const normalize = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** URL du logo d'une technologie, ou null s'il n'y en a pas. */
export function stackLogo(name: string): string | null {
  const slug = LOGOS[normalize(name)];
  return slug ? `/stack-logos/${slug}.svg` : null;
}
