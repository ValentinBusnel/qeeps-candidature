import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "./db.js";
import { Profile, Project, Settings, User } from "./models.js";
import { DOCS_BLOCK, DOCUMENTS_SEED, profileSeed, projectsSeed, settingsSeed, SEED_VERSION } from "./data/seed-data.js";
import { hashPassword } from "./auth.js";
import { importBundledContent } from "./content.js";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Ajoute à `target` les clés de `defaults` qui manquent, sans jamais écraser une valeur existante. */
function fillMissing(target: Obj, defaults: Obj, path = ""): Obj {
  const patch: Obj = {};
  for (const [key, value] of Object.entries(defaults)) {
    const full = path ? `${path}.${key}` : key;
    if (!(key in target) || target[key] === undefined) patch[full] = value;
    else if (isObj(value) && isObj(target[key])) Object.assign(patch, fillMissing(target[key] as Obj, value, full));
  }
  return patch;
}

/** Remet TOUT à zéro avec seed-data.ts (commande `npm run seed`). */
export async function runSeed() {
  await Profile.deleteMany({});
  await Profile.create(profileSeed);
  await Project.deleteMany({});
  await Project.insertMany(projectsSeed);
  await Settings.deleteMany({});
  await Settings.create(settingsSeed);
  console.log(`🌱 Seed v${SEED_VERSION} : 1 profil, ${projectsSeed.length} projets (contenu remis à zéro).`);
}

/**
 * Au démarrage : remplit une base vide, puis complète les champs ajoutés depuis
 * sans toucher à ce qui a été modifié dans l'admin.
 */
export async function ensureContent() {
  // première mise en ligne : on reprend le contenu embarqué (server/content) plutôt que le seed
  if (await importBundledContent(MIGRATIONS.map((m) => m.id))) return;
  const profile = await Profile.findOne().lean<Obj>();
  if (!profile) {
    await Profile.create(profileSeed);
    console.log("🌱 Profil créé à partir de seed-data.ts");
  } else {
    const patch = fillMissing(profile, profileSeed as unknown as Obj);
    delete patch.seedVersion;
    if (Object.keys(patch).length) {
      await Profile.updateOne({ _id: profile._id }, { $set: { ...patch, seedVersion: SEED_VERSION } });
      console.log(`🧩 Profil complété : ${Object.keys(patch).join(", ")}`);
    }
  }

  if ((await Project.countDocuments()) === 0) await Project.insertMany(projectsSeed);
  else {
    // ajoute les champs manquants (ex. "media") aux projets existants
    for (const seed of projectsSeed) {
      const existing = await Project.findOne({ slug: seed.slug }).lean<Obj>();
      if (!existing) continue;
      const patch = fillMissing(existing, seed as unknown as Obj);
      if (Object.keys(patch).length) await Project.updateOne({ _id: existing._id }, { $set: patch });
    }
  }

  if (!(await Settings.exists({}))) await Settings.create(settingsSeed);
}

/**
 * Modifications de contenu demandées ponctuellement, appliquées une seule fois
 * (leur identifiant est mémorisé dans Settings.migrations).
 */
const MIGRATIONS: { id: string; run: () => Promise<void> }[] = [
  {
    id: "2026-10-07-retire-6-technos",
    run: async () => {
      const profile = await Profile.findOne().lean<Obj>();
      if (!profile) return;
      const remove = new Set(["zod", "serveractions", "playwright", "html", "css", "nextjs", "next"]);
      const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
      const skills = ((profile.skills as { category: string; items: string[] }[]) ?? []).map((g) => ({
        ...g,
        items: g.items.filter((i) => !remove.has(norm(i)))
      }));
      const total = skills.reduce((n, g) => n + g.items.length, 0);
      const stats = ((profile.stats as { label: string; value: number }[]) ?? []).map((st) =>
        /technolog/i.test(st.label) ? { ...st, value: total } : st
      );
      await Profile.updateOne({ _id: profile._id }, { $set: { skills, stats } });
      console.log(`🧹 Stack mise à jour : ${total} technologies`);
    }
  },
  {
    id: "2026-10-07-avatar-memoji",
    run: async () => {
      const res = await Profile.updateOne(
        { $or: [{ avatarUrl: "/avatar-valentin.svg" }, { avatarUrl: { $exists: false } }, { avatarUrl: "" }] },
        { $set: { avatarUrl: "/avatar-valentin.png" } }
      );
      if (res.modifiedCount) console.log("🙂 Avatar Memoji appliqué");
    }
  },
  {
    // 5 mails tous différents (le 5e répétait le 1er) ; seulement si les mails d'origine n'ont pas été modifiés
    id: "2026-10-07-mails-stg",
    run: async () => {
      const profile = await Profile.findOne().lean<Obj>();
      const sections = profile?.sections as { features?: { messages?: { text: string }[] } } | undefined;
      const current = sections?.features?.messages ?? [];
      const untouched = current.length <= 4 && current.every((m) => /Azure ne remonte plus|référentiel des tiers, c'est faisable|flux Talend est en erreur|Merci pour le correctif d'hier, tout fonctionne/.test(m.text));
      if (!profile || !untouched) return;
      await Profile.updateOne({ _id: profile._id }, { $set: { "sections.features.messages": profileSeed.sections.features.messages } });
      console.log("✉️  Mails STG mis à jour");
    }
  },
  {
    // 1er mail : incident sur l'export du référentiel des tiers (si les 2 premiers mails n'ont pas été modifiés)
    id: "2026-10-07-mail-referentiel-tiers",
    run: async () => {
      const profile = await Profile.findOne().lean<Obj>();
      const sections = profile?.sections as { features?: { messages?: { text: string }[] } } | undefined;
      const msgs = sections?.features?.messages;
      if (!profile || !msgs || msgs.length < 2) return;
      const seedMsgs = profileSeed.sections.features.messages;
      const set: Obj = {};
      if (/export des factures vers Azure/.test(msgs[0].text)) set["sections.features.messages.0"] = seedMsgs[0];
      if (/filtrer le référentiel des tiers par entité/.test(msgs[1].text)) set["sections.features.messages.1"] = seedMsgs[1];
      if (Object.keys(set).length) {
        await Profile.updateOne({ _id: profile._id }, { $set: set });
        console.log("✉️  1er mail : export du référentiel des tiers");
      }
    }
  },
  {
    // retire le « strict » affiché après « TS » dans la tuile TypeScript
    id: "2026-10-07-tile-ts-sans-strict",
    run: async () => {
      const profile = await Profile.findOne().lean<Obj>();
      const tiles = (profile?.sections as { features?: { tiles?: { unit?: string }[] } } | undefined)?.features?.tiles;
      if (!profile || !tiles) return;
      const idx = tiles.findIndex((t) => t.unit === "strict");
      if (idx >= 0) await Profile.updateOne({ _id: profile._id }, { $set: { [`sections.features.tiles.${idx}.unit`]: "" } });
    }
  },
  {
    // Anasawi : textes de départ (seulement s'ils sont encore « À COMPLÉTER ») et vidéos optimisées pour le web
    id: "2026-10-07-anasawi-vitrine",
    run: async () => {
      const project = await Project.findOne({ slug: "anasawi" }).lean<Obj>();
      const seed = projectsSeed.find((p) => p.slug === "anasawi");
      if (!project || !seed) return;
      const set: Obj = {};
      const todo = (v: unknown) => typeof v === "string" && /à compléter/i.test(v);
      if (todo(project.description)) set.description = seed.description;
      if (todo(project.tagline)) set.tagline = seed.tagline;
      const highlights = (project.highlights as string[]) ?? [];
      if (!highlights.length || highlights.some(todo)) set.highlights = seed.highlights;
      if (!((project.links as unknown[]) ?? []).length) set.links = seed.links;

      // remplace les .mov de l'écran (100 Mo) par leurs versions web, vidéos en premier
      type M = { type: string; src: string; caption: string; poster?: string };
      const swap: Record<string, M> = {
        "enregistrement-de-l-ecran-2026-10-07-a-14-10-08-30374d.mov": seed.media[0] as M,
        "enregistrement-de-l-ecran-2026-10-07-a-14-17-21-99d0e2.mov": seed.media[1] as M,
        "capture-d-ecran-2026-10-07-a-11-53-48-adf564.png": seed.media[2] as M
      };
      const generic = /^(vidéo du site|vidéo de l'administration|page d'accueil)$/i;
      let changed = false;
      const media = ((project.media as M[]) ?? []).map((m) => {
        const file = m.src.split("/").pop() ?? "";
        const web = swap[file];
        if (!web) return m;
        changed = true;
        return { ...web, caption: generic.test(m.caption.trim()) ? web.caption : m.caption };
      });
      if (changed) {
        media.sort((a, b) => (a.type === b.type ? 0 : a.type === "video" ? -1 : 1));
        set.media = media;
      }
      if (Object.keys(set).length) {
        await Project.updateOne({ _id: project._id }, { $set: set });
        console.log(`🎬 Anasawi mis à jour : ${Object.keys(set).join(", ")}`);
      }
    }
  },
  {
    id: "2026-10-07-anasawi-badges",
    run: async () => {
      const seed = projectsSeed.find((p) => p.slug === "anasawi");
      await Project.updateOne(
        { slug: "anasawi", $or: [{ badges: { $exists: false } }, { badges: { $size: 0 } }] },
        { $set: { badges: seed?.badges ?? [] } }
      );
    }
  },
  {
    // Anasawi a été fait pour une amie, pas pour une cliente
    id: "2026-10-07-anasawi-amie",
    run: async () => {
      await Project.updateOne(
        { slug: "anasawi", "badges.label": "anasawi.com, pour une vraie cliente" },
        { $set: { "badges.$.label": "anasawi.com, pour une amie thérapeute" } }
      );
    }
  },
  {
    // « Cette candidature » passe en vitrine : vidéos du back-office et du responsive, badges et textes
    id: "2026-10-07-candidature-vitrine",
    run: async () => {
      const project = await Project.findOne({ slug: "candidature-qeeps" }).lean<Obj>();
      const seed = projectsSeed.find((p) => p.slug === "candidature-qeeps");
      if (!project || !seed) return;
      const set: Obj = { featured: true };
      const media = (project.media as { src: string }[]) ?? [];
      if (!media.length || media.every((m) => m.src.startsWith("/projects/candidature-qeeps/"))) set.media = seed.media;
      if (!((project.badges as unknown[]) ?? []).length) set.badges = seed.badges;
      if (project.tagline === "Landing page + charte graphique") set.tagline = seed.tagline;
      if (/^Une page de candidature aux couleurs de Qeeps, avec une charte/.test(String(project.description))) set.description = seed.description;
      const hl = (project.highlights as string[]) ?? [];
      if (hl.join("|") === "Design system piloté par des tokens|API REST + MongoDB|Animations au scroll") set.highlights = seed.highlights;
      await Project.updateOne({ _id: project._id }, { $set: set });
      console.log(`🎬 Cette candidature en vitrine : ${Object.keys(set).join(", ")}`);
    }
  },
  {
    // nouveau projet : le portfolio d'Ambre Clément, placé entre Anasawi et cette candidature
    id: "2026-10-07-projet-ambre-clement",
    run: async () => {
      const seed = projectsSeed.find((p) => p.slug === "ambre-clement");
      if (!seed || (await Project.exists({ slug: "ambre-clement" }))) return;
      await Project.updateMany({ order: { $gte: 2 }, slug: { $ne: "anasawi" } }, { $inc: { order: 1 } });
      await Project.create({ ...seed, order: 2 });
      console.log("📸 Projet Ambre Clément ajouté");
    }
  },
  {
    // Anasawi : on garde les vidéos de Valentin et on ajoute une vidéo « ordinateur & mobile » générée
    id: "2026-10-08-anasawi-mobile",
    run: async () => {
      const item = { type: "video", src: "/uploads/projets-anasawi/web/mobile.mp4", poster: "/uploads/projets-anasawi/web/mobile.jpg", caption: "Mobile & desktop" };
      const project = await Project.findOne({ slug: "anasawi" }).lean<Obj>();
      if (!project) return;
      const media = ((project.media as { src: string }[]) ?? []).slice();
      if (media.some((m) => m.src === item.src)) return;
      // juste après les vidéos existantes, avant les photos
      const at = media.findIndex((m) => !/\.mp4$/i.test(m.src));
      media.splice(at === -1 ? media.length : at, 0, item);
      await Project.updateOne({ _id: project._id }, { $set: { media } });
      console.log("📱 Anasawi : vidéo mobile ajoutée");
    }
  },
  {
    // Anasawi : les vidéos de Valentin passent dans le cadre de navigateur (comme les autres projets),
    // et la photo de la page d'accueil est retirée
    id: "2026-10-08-anasawi-cadre",
    run: async () => {
      const project = await Project.findOne({ slug: "anasawi" }).lean<Obj>();
      if (!project) return;
      const swap: Record<string, { src: string; poster: string }> = {
        "/uploads/projets-anasawi/web/site.mp4": { src: "/uploads/projets-anasawi/web/site-cadre.mp4", poster: "/uploads/projets-anasawi/web/site-cadre.jpg" },
        "/uploads/projets-anasawi/web/admin.mp4": { src: "/uploads/projets-anasawi/web/admin-cadre.mp4", poster: "/uploads/projets-anasawi/web/admin-cadre.jpg" }
      };
      const media = ((project.media as { src: string; poster?: string }[]) ?? [])
        .filter((m) => m.src !== "/uploads/projets-anasawi/web/accueil.jpg")
        .map((m) => (swap[m.src] ? { ...m, ...swap[m.src] } : m));
      await Project.updateOne({ _id: project._id }, { $set: { media } });
      console.log("🎞️ Anasawi : vidéos encadrées, photo d'accueil retirée");
    }
  },
  {
    // Points forts réécrits : ce qui compte vraiment pour chaque projet (seulement s'ils n'ont pas été modifiés)
    id: "2026-10-08-points-forts",
    run: async () => {
      const olds: Record<string, string[]> = {"anasawi": ["Éditeur de pages en direct — une bibliothèque de sections prêtes à l'emploi, réorganisables à la volée", "Thèmes et couleurs — apparence, menu et réglages du site modifiables depuis l'administration", "Messagerie intégrée — avec la gestion des médias et des utilisateurs"], "ambre-clement": ["Back-office complet — onglets, galeries par glisser-déposer, projets, tarifs et statistiques de visite", "Images optimisées — pipeline sharp AVIF/WebP multi-tailles, servi par le CDN Cloudflare R2", "SEO — rendu serveur (SSR/SSG), métadonnées, JSON-LD et sitemap dynamiques"], "candidature-qeeps": ["Back-office complet — authentification, CRUD sur tout le contenu, médias, messages et couleurs", "Responsive — pensé pour le mobile, la tablette et le desktop", "Charte Qeeps — tokens, typographies et animations relevés sur byqeeps.com"]};
      for (const [slug, old] of Object.entries(olds)) {
        const seed = projectsSeed.find((p) => p.slug === slug);
        const project = await Project.findOne({ slug }).lean<Obj>();
        if (!seed || !project) continue;
        if (((project.highlights as string[]) ?? []).join("|") !== old.join("|")) continue;
        await Project.updateOne({ _id: project._id }, { $set: { highlights: seed.highlights } });
      }
      console.log("✨ Points forts mis à jour");
    }
  },
  {
    // Anasawi : on retire « Le site en mouvement » et la vidéo « Mobile & desktop » passe en premier
    id: "2026-10-08-anasawi-ordre",
    run: async () => {
      const project = await Project.findOne({ slug: "anasawi" }).lean<Obj>();
      if (!project) return;
      const media = ((project.media as { src: string }[]) ?? []).filter((m) => !/\/site(-cadre)?\.mp4$/.test(m.src));
      const mobile = media.filter((m) => m.src.endsWith("/mobile.mp4"));
      const rest = media.filter((m) => !m.src.endsWith("/mobile.mp4"));
      await Project.updateOne({ _id: project._id }, { $set: { media: [...mobile, ...rest] } });
      console.log("📱 Anasawi : vidéo mobile en premier");
    }
  },
  {
    // Résumé de l'expérience STG plus parlant (seulement s'il n'a pas été modifié dans l'admin)
    id: "2026-10-08-stg-resume",
    run: async () => {
      const profile = await Profile.findOne().lean<Obj>();
      if (!profile) return;
      const xps = (profile.experiences as { id: string; summary: string }[]) ?? [];
      const stg = xps.find((x) => x.id === "stg");
      if (!stg || stg.summary !== "Data Engineering & développement applicatif") return;
      stg.summary = "Au cœur des données du groupe : je fiabilisais les flux Talend vers Snowflake et faisais évoluer l'application du référentiel des tiers, du diagnostic jusqu'à la mise en production.";
      await Profile.updateOne({ _id: profile._id }, { $set: { experiences: xps } });
      console.log("📝 Résumé STG mis à jour");
    }
  },
  {
    // La charte graphique est retirée : le bouton secondaire du hero ouvre « À propos de ce site »
    id: "2026-10-08-bouton-a-propos",
    run: async () => {
      await Profile.updateOne(
        { "sections.heroButtons.secondary": "Charte graphique" },
        { $set: { "sections.heroButtons.secondary": "À propos de ce site" } }
      );
    }
  },
  {
    // les logos STG / OÏA deviennent des champs modifiables (plus de logo codé en dur)
    id: "2026-10-08-logos-modifiables",
    run: async () => {
      const profile = await Profile.findOne().lean<Obj>();
      if (!profile) return;
      const logos: Record<string, string> = { stg: "/logos/stg.png", oia: "/logos/oia.png" };
      const experiences = ((profile.experiences as { id: string; logoUrl?: string }[]) ?? []).map((x) =>
        !x.logoUrl && logos[x.id] ? { ...x, logoUrl: logos[x.id] } : x
      );
      await Profile.updateOne({ _id: profile._id }, { $set: { experiences } });
    }
  },
  {
    // les formations deviennent les cartes « pass » de « Comment je travaille » : chaque carte a son badge
    id: "2026-10-09-cartes-formation",
    run: async () => {
      const profile = await Profile.findOne().lean<Obj>();
      if (!profile) return;
      const education = ((profile.education as { school: string; badge?: string }[]) ?? []).map((e) =>
        e.badge === undefined ? { ...e, badge: /wagon/i.test(e.school) ? "Certifié" : "" } : e
      );
      await Profile.updateOne({ _id: profile._id }, { $set: { education } });
    }
  },
  {
    // Ruby et Ruby on Rails rejoignent la stack (groupe Back-end, après Spring Batch)
    id: "2026-10-09-stack-ruby",
    run: async () => {
      const profile = await Profile.findOne().lean<Obj>();
      if (!profile) return;
      const skills = ((profile.skills as { category: string; items: string[] }[]) ?? []).map((g) => ({ ...g, items: [...g.items] }));
      const all = skills.flatMap((g) => g.items.map((i) => i.toLowerCase()));
      const missing = ["Ruby", "Ruby on Rails"].filter((t) => !all.includes(t.toLowerCase()));
      if (!missing.length) return;
      const group = skills.find((g) => /back/i.test(g.category)) ?? skills[0];
      if (!group) return;
      const at = group.items.indexOf("Spring Batch");
      group.items.splice(at >= 0 ? at + 1 : group.items.length, 0, ...missing);
      await Profile.updateOne({ _id: profile._id }, { $set: { skills } });
      console.log("📝 Ruby et Ruby on Rails ajoutés à la stack");
    }
  },
  {
    // nouveau bloc « Ma candidature » : CV, recommandation et lettre de motivation
    id: "2026-10-09-ma-candidature",
    run: async () => {
      const profile = await Profile.findOne().lean<Obj>();
      if (!profile) return;
      const $set: Obj = {};
      if (!Array.isArray(profile.documents) || !profile.documents.length) $set.documents = DOCUMENTS_SEED;
      const sections = (profile.sections as Obj) ?? {};
      const features = (sections.features as Obj) ?? {};
      const blocks = (features.blocks as { visual?: string }[]) ?? [];
      if (!blocks.some((b) => b.visual === "docs")) $set["sections.features.blocks"] = [...blocks, DOCS_BLOCK];
      if (!profile.cvUrl) $set.cvUrl = DOCUMENTS_SEED[0].file;
      if (Object.keys($set).length) await Profile.updateOne({ _id: profile._id }, { $set });
      console.log("📝 Bloc « Ma candidature » ajouté");
    }
  },
  {
    // nouvelle version du CV (le fichier change de nom pour ne pas resservir l'ancien en cache)
    id: "2026-10-09-cv-v2",
    run: async () => {
      const profile = await Profile.findOne().lean<Obj>();
      if (!profile) return;
      const OLD = "/uploads/candidature/cv-valentin-busnel.pdf";
      const NEW = "/uploads/candidature/cv-valentin-busnel-v2.pdf";
      const documents = ((profile.documents as { file?: string }[]) ?? []).map((d) => (d.file === OLD ? { ...d, file: NEW } : d));
      const $set: Obj = { documents };
      if (profile.cvUrl === OLD) $set.cvUrl = NEW;
      await Profile.updateOne({ _id: profile._id }, { $set });
    }
  },
  {
    // le bouton CV de la carte de visite suit le CV du bloc « Ma candidature »
    id: "2026-10-09-cv-bouton",
    run: async () => {
      const profile = await Profile.findOne().lean<Obj>();
      const cv = ((profile?.documents as { id: string; file?: string }[]) ?? []).find((d) => d.id === "cv")?.file;
      if (profile && cv && profile.cvUrl !== cv) await Profile.updateOne({ _id: profile._id }, { $set: { cvUrl: cv } });
    }
  }
];

export async function runMigrations() {
  const settings = await Settings.findOne();
  if (!settings) return;
  const done = new Set(settings.get("migrations") ?? []);
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await m.run();
    done.add(m.id);
  }
  settings.set("migrations", [...done]);
  await settings.save();
}

/** Crée le compte admin à partir de ADMIN_EMAIL / ADMIN_PASSWORD s'il n'en existe aucun. */
export async function ensureAdmin() {
  if ((await User.countDocuments()) > 0) return;
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 10) {
    console.warn(
      "⚠️  Aucun compte admin : renseigne ADMIN_EMAIL et ADMIN_PASSWORD (10 caractères min.) dans server/.env puis redémarre."
    );
    return;
  }
  await User.create({ email, passwordHash: hashPassword(password) });
  console.log(`🔐 Compte admin créé pour ${email}`);
}

// Exécution directe : `npm run seed`
if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/qeeps-candidature";
  if (!(await connectDb(uri))) process.exit(1);
  await runSeed();
  await ensureAdmin();
  await mongoose.disconnect();
}
