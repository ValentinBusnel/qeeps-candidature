/**
 * Catalogue de technologies pour l'autocomplétion de l'admin (~3 600 entrées) :
 * - Devicon (logos en couleur des outils de dev) en priorité ;
 * - Simple Icons (toutes les marques tech, logos d'une couleur) pour le reste.
 * Chargé depuis jsDelivr, à la demande, uniquement dans l'admin (versions figées).
 * Le site public n'en dépend pas : un logo choisi est recopié dans les fichiers du site.
 */
import { normalizeStack } from "./stackLogos";

const DEVICON = "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0";
const SIMPLE = "https://cdn.jsdelivr.net/npm/simple-icons@16.34.0";

export interface CatalogEntry {
  name: string;
  /** devicon : icône en couleur ; simple : icône d'une couleur (hex) */
  kind: "devicon" | "simple";
  id: string;
  /** variante devicon, ou couleur hex simple-icons */
  extra: string;
  /** noms alternatifs normalisés (recherche) */
  keys: string[];
  norm: string;
}

/** Noms lisibles des entrées Devicon qui n'existent pas dans Simple Icons. */
const PRETTY: Record<string, string> = {
  aarch64: "AArch64", aftereffects: "After Effects", amazonwebservices: "Amazon Web Services", angularjs: "AngularJS",
  angularmaterial: "Angular Material", apl: "APL", argocd: "Argo CD", awk: "AWK", azure: "Microsoft Azure",
  azuredevops: "Azure DevOps", azuresqldatabase: "Azure SQL Database", browserstack: "BrowserStack", clojurescript: "ClojureScript",
  cloudrun: "Cloud Run", cobol: "COBOL", codepen: "CodePen", corejs: "core-js", cosmosdb: "Azure Cosmos DB", csharp: "C#",
  css3: "CSS", d3js: "D3.js", dataspell: "DataSpell", datatables: "DataTables", denojs: "Deno", detaspace: "Deta Space",
  djangorest: "Django REST Framework", dotnetcore: ".NET Core", dyalog: "Dyalog APL", dynamodb: "Amazon DynamoDB",
  embeddedc: "Embedded C", entityframeworkcore: "Entity Framework Core", feathersjs: "Feathers", filamentphp: "Filament",
  fusion: "Fusion 360", gcc: "GCC", githubcodespaces: "GitHub Codespaces", grpc: "gRPC", hyperv: "Hyper-V",
  ie10: "Internet Explorer", illustrator: "Adobe Illustrator", inertiajs: "Inertia.js", jiraalign: "Jira Align", junit: "JUnit",
  k3os: "k3OS", karatelabs: "Karate Labs", knockout: "Knockout.js", krakenjs: "Kraken.js", laraveljetstream: "Laravel Jetstream",
  libgdx: "libGDX", linkedin: "LinkedIn", love2d: "LÖVE", materializecss: "Materialize CSS", matlab: "MATLAB", maya: "Autodesk Maya",
  microsoftsqlserver: "Microsoft SQL Server", msdos: "MS-DOS", netbeans: "NetBeans", netbox: "NetBox", networkx: "NetworkX",
  nhibernate: "NHibernate", nodewebkit: "NW.js", npss: "NPSS", nuxtjs: "Nuxt.js", oauth: "OAuth", objectivec: "Objective-C",
  ohmyzsh: "Oh My Zsh", openal: "OpenAL", openapi: "OpenAPI", opencl: "OpenCL", photoshop: "Adobe Photoshop", pixijs: "PixiJS",
  powershell: "PowerShell", premierepro: "Premiere Pro", putty: "PuTTY", pyscript: "PyScript", qtest: "qTest",
  reactnative: "React Native", reactnavigation: "React Navigation", rspec: "RSpec", rstudio: "RStudio", rxjs: "RxJS", sdl: "SDL",
  shotgrid: "ShotGrid", solidjs: "SolidJS", spicedb: "SpiceDB", spss: "SPSS", sqldeveloper: "SQL Developer", ssh: "SSH", tex: "TeX",
  threedsmax: "3ds Max", titaniumsdk: "Titanium SDK", tomcat: "Apache Tomcat", tortoisegit: "TortoiseGit", towergit: "Tower",
  uwsgi: "uWSGI", veevalidate: "VeeValidate", visualbasic: "Visual Basic", visualstudio: "Visual Studio", vscode: "VS Code",
  vsphere: "vSphere", vuestorefront: "Vue Storefront", windows11: "Windows 11", windows8: "Windows 8", xd: "Adobe XD",
  yugabytedb: "YugabyteDB"
};

type SimpleIcon = { title: string; slug: string; hex: string; aliases?: { aka?: string[] } };
type Devicon = { name: string; altnames?: string[]; versions: { svg?: string[] } };

let promise: Promise<CatalogEntry[]> | null = null;

/** Le catalogue complet (téléchargé une seule fois par session d'admin). */
export function loadCatalog(): Promise<CatalogEntry[]> {
  promise ??= Promise.all([
    fetch(`${DEVICON}/devicon.json`).then((r) => r.json() as Promise<Devicon[]>),
    fetch(`${SIMPLE}/data/simple-icons.json`).then((r) => r.json() as Promise<SimpleIcon[] | { icons: SimpleIcon[] }>)
  ])
    .then(([dv, siRaw]) => {
      const si = Array.isArray(siRaw) ? siRaw : siRaw.icons;
      const bySlug = new Map<string, SimpleIcon>();
      for (const i of si) {
        bySlug.set(i.slug, i);
        bySlug.set(normalizeStack(i.title), i);
      }
      const out: CatalogEntry[] = [];
      const seen = new Set<string>();
      const used = new Set<string>();
      const push = (e: Omit<CatalogEntry, "norm">) => {
        const norm = normalizeStack(e.name);
        if (!norm || seen.has(norm)) return;
        seen.add(norm);
        out.push({ ...e, norm, keys: [...new Set(e.keys.filter((k) => k && k !== norm))] });
      };
      for (const d of dv) {
        const svgs = d.versions.svg ?? [];
        if (!svgs.length) continue;
        const v = svgs.find((x) => x === "original") ?? svgs.find((x) => x === "plain") ?? svgs.find((x) => !x.includes("wordmark")) ?? svgs[0];
        const match = bySlug.get(d.name) ?? (d.altnames ?? []).map((a) => bySlug.get(normalizeStack(a))).find(Boolean);
        if (match) used.add(match.slug);
        const name = PRETTY[d.name] ?? match?.title ?? d.name.charAt(0).toUpperCase() + d.name.slice(1);
        push({ name, kind: "devicon", id: d.name, extra: v, keys: [d.name, ...(d.altnames ?? []), ...(match?.aliases?.aka ?? []), match?.title ?? ""].map(normalizeStack) });
      }
      for (const i of si) {
        if (used.has(i.slug)) continue;
        push({ name: i.title, kind: "simple", id: i.slug, extra: i.hex, keys: [i.slug, ...(i.aliases?.aka ?? [])].map(normalizeStack) });
      }
      return out;
    })
    .catch((e) => {
      promise = null; // nouvel essai à la prochaine frappe
      throw e;
    });
  return promise;
}

/** Les meilleures correspondances pour une saisie (nom exact, début du nom, début d'un mot, contenu). */
export function searchCatalog(catalog: CatalogEntry[], query: string, limit = 8): CatalogEntry[] {
  const q = normalizeStack(query);
  if (!q) return [];
  const words = query.toLowerCase().trim();
  const scored: { e: CatalogEntry; score: number; i: number }[] = [];
  catalog.forEach((e, i) => {
    let score = 0;
    if (e.norm === q) score = 100;
    else if (e.keys.includes(q)) score = 90;
    else if (e.norm.startsWith(q)) score = 70 - Math.min(20, e.norm.length - q.length);
    else if (e.name.toLowerCase().split(/[\s.\-/]+/).some((w) => w.startsWith(words))) score = 50;
    else if (e.keys.some((k) => k.startsWith(q))) score = 40;
    else if (q.length >= 3 && e.norm.includes(q)) score = 20;
    if (!score) return;
    if (e.kind === "devicon") score += 5; // les outils de dev d'abord, à égalité
    scored.push({ e, score, i });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((s) => s.e);
}

/** Adresse de l'icône sur le CDN (aperçu dans la liste). */
export function catalogIconUrl(e: CatalogEntry) {
  return e.kind === "devicon" ? `${DEVICON}/icons/${e.id}/${e.id}-${e.extra}.svg` : `${SIMPLE}/icons/${e.id}.svg`;
}

/** Couleur d'affichage d'une icône Simple Icons (une couleur trop claire disparaîtrait sur fond blanc). */
export function simpleColor(hex: string) {
  const n = parseInt(hex, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 225 ? "#164951" : `#${hex}`;
}

/**
 * Récupère le SVG d'une entrée, prêt à être enregistré sur le site
 * (les icônes Simple Icons reçoivent leur couleur de marque).
 */
export async function catalogLogoFile(e: CatalogEntry): Promise<File> {
  const res = await fetch(catalogIconUrl(e));
  if (!res.ok) throw new Error("Logo introuvable");
  let svg = await res.text();
  if (e.kind === "simple") svg = svg.replace(/<svg\b/, `<svg fill="${simpleColor(e.extra)}"`);
  return new File([svg], `${e.id}.svg`, { type: "image/svg+xml" });
}
