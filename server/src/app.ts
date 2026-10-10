import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { z } from "zod";
import { isDbConnected } from "./db.js";
import { Message, Profile, Project, Settings, User } from "./models.js";
import { profileSeed, projectsSeed, settingsSeed } from "./data/seed-data.js";
import {
  clearSessionCookie,
  createToken,
  getCookie,
  hashPassword,
  loginAllowed,
  readToken,
  recordLoginFailure,
  requireAuth,
  resetLoginFailures,
  setSessionCookie,
  verifyPassword,
  type AuthedRequest
} from "./auth.js";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, UPLOAD_DIR, deleteUpload, listUploads, saveUpload } from "./uploads.js";
import { runSeed } from "./seed.js";
import { checkSetupKey, consumeSetupKey } from "./setup.js";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));

type Handler = (req: AuthedRequest, res: Response) => Promise<unknown>;
/** Transmet les erreurs async au gestionnaire d'erreurs. */
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

/** Retire les champs techniques de Mongo avant d'enregistrer un document reçu du client. */
function clean<T extends Record<string, unknown>>(doc: T) {
  const { _id, __v, createdAt, updatedAt, ...rest } = doc;
  void _id; void __v; void createdAt; void updatedAt;
  return rest;
}

/* ---------- Schémas de validation ---------- */
const nonEmpty = z.string().trim().min(1);
const mediaSchema = z.object({
  type: z.enum(["image", "video"]),
  src: nonEmpty,
  caption: z.string().default(""),
  poster: z.string().optional()
});
const projectSchema = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9-]+$/, "Slug : lettres minuscules, chiffres et tirets uniquement"),
    title: nonEmpty,
    tagline: z.string().default(""),
    description: z.string().default(""),
    role: z.string().default(""),
    year: z.string().default(""),
    status: z.string().default(""),
    stack: z.array(z.string()).default([]),
    highlights: z.array(z.string()).default([]),
    links: z.array(z.object({ label: nonEmpty, url: nonEmpty })).default([]),
    media: z.array(mediaSchema).default([]),
    badges: z
      .array(z.object({ icon: z.string().default("check"), value: z.string().default(""), label: z.string().default("") }))
      .max(3)
      .default([]),
    featured: z.boolean().default(false),
    order: z.number().default(0)
  })
  .strip();
const profileSchema = z
  .object({
    fullName: nonEmpty,
    email: z.string().trim(),
    summary: z.array(z.string()),
    skills: z.array(z.object({ category: z.string(), items: z.array(z.string()) })),
    experiences: z.array(z.object({ company: z.string() }).passthrough()),
    education: z.array(z.object({ school: z.string() }).passthrough()),
    stats: z.array(z.object({ value: z.number(), label: z.string() }).passthrough()),
    sections: z.object({}).passthrough()
  })
  .passthrough();
const settingsSchema = z.object({
  colors: z.record(z.string().regex(/^--[a-z0-9-]+$/), z.string().regex(/^#[0-9a-fA-F]{6}$/))
});

export function createApp(clientOrigin: string) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cors({ origin: clientOrigin, credentials: true }));
  app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d", fallthrough: false }));

  // L'upload lit le corps brut ; il est déclaré avant express.json
  const auth = requireAuth((id) => User.findById(id).lean());
  const needDb = (_req: Request, res: Response, next: NextFunction) =>
    isDbConnected() ? next() : res.status(503).json({ error: "Base de données indisponible" });

  app.post(
    "/api/admin/uploads",
    needDb,
    auth,
    express.raw({ type: Object.keys(ALLOWED_TYPES), limit: MAX_UPLOAD_BYTES }),
    h(async (req, res) => {
      const mime = (req.get("Content-Type") ?? "").split(";")[0];
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: "Fichier vide ou type non autorisé" });
      const name = String(req.query.name ?? "fichier");
      const folder = String(req.query.folder ?? "divers");
      try {
        res.status(201).json(await saveUpload(req.body, mime, name, folder));
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    })
  );

  app.use(express.json({ limit: "2mb" }));

  /* ======================= Public ======================= */
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, db: isDbConnected() ? "connected" : "fallback" });
  });

  app.get(
    "/api/profile",
    h(async (_req, res) => {
      if (!isDbConnected()) return res.json(profileSeed);
      res.json((await Profile.findOne().lean()) ?? profileSeed);
    })
  );

  app.get(
    "/api/projects",
    h(async (_req, res) => {
      if (!isDbConnected()) return res.json(projectsSeed);
      res.json(await Project.find().sort({ order: 1 }).lean());
    })
  );

  app.get(
    "/api/settings",
    h(async (_req, res) => {
      if (!isDbConnected()) return res.json(settingsSeed);
      res.json((await Settings.findOne().lean()) ?? settingsSeed);
    })
  );

  const messageInput = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    company: z.string().trim().max(120).optional(),
    message: z.string().trim().min(10).max(3000)
  });

  app.post(
    "/api/messages",
    needDb,
    h(async (req, res) => {
      const parsed = messageInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Champs invalides", details: parsed.error.flatten() });
      await Message.create(parsed.data);
      res.status(201).json({ ok: true });
    })
  );

  /* ======================= Authentification ======================= */
  app.post(
    "/api/auth/login",
    needDb,
    h(async (req, res) => {
      const ip = req.ip ?? "unknown";
      if (!loginAllowed(ip)) return res.status(429).json({ error: "Trop de tentatives, réessaie dans 15 minutes" });
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const password = String(req.body?.password ?? "");
      const user = await User.findOne({ email });
      if (!user || !verifyPassword(password, user.passwordHash)) {
        recordLoginFailure(ip);
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }
      resetLoginFailures(ip);
      setSessionCookie(res, createToken({ sub: user.id, ver: user.sessionVersion }));
      res.json({ email: user.email });
    })
  );

  // Première connexion : y a-t-il déjà un compte ? (sinon la page de connexion propose d'en créer un)
  app.get(
    "/api/auth/setup",
    h(async (req, res) => {
      if (!isDbConnected()) return res.json({ needed: false });
      const needed = (await User.countDocuments()) === 0;
      const key = String(req.query.cle ?? "");
      res.json({ needed, keyValid: needed && key ? checkSetupKey(key) : false, email: needed ? process.env.ADMIN_EMAIL ?? "" : "" });
    })
  );

  // Création du premier compte avec la clé à usage unique affichée dans les journaux du serveur
  app.post(
    "/api/auth/setup",
    needDb,
    h(async (req, res) => {
      if (req.get("X-Requested-With") !== "admin") return res.status(403).json({ error: "Requête refusée" });
      const ip = req.ip ?? "unknown";
      if (!loginAllowed(ip)) return res.status(429).json({ error: "Trop de tentatives, réessaie dans 15 minutes" });
      if ((await User.countDocuments()) > 0) return res.status(409).json({ error: "Le compte admin existe déjà : connecte-toi." });
      const body = z
        .object({
          key: z.string().min(1),
          email: z.string().trim().toLowerCase().email("Email invalide"),
          password: z.string().min(10, "Le mot de passe doit faire au moins 10 caractères").max(200)
        })
        .safeParse(req.body);
      if (!body.success) return res.status(400).json({ error: body.error.issues[0]?.message ?? "Champs invalides" });
      if (!checkSetupKey(body.data.key)) {
        recordLoginFailure(ip);
        return res.status(403).json({ error: "Clé de première connexion invalide : ouvre le lien affiché dans les journaux du serveur." });
      }
      const user = await User.create({ email: body.data.email, passwordHash: hashPassword(body.data.password) });
      consumeSetupKey();
      resetLoginFailures(ip);
      console.log(`🔐 Compte admin créé depuis le site pour ${user.email}`);
      setSessionCookie(res, createToken({ sub: user.id, ver: user.sessionVersion }));
      res.status(201).json({ email: user.email });
    })
  );

  app.post("/api/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get(
    "/api/auth/me",
    h(async (req, res) => {
      const payload = readToken(getCookie(req));
      if (!payload || !isDbConnected()) return res.status(401).json({ error: "Non connecté" });
      const user = await User.findById(payload.sub).lean();
      if (!user || user.sessionVersion !== payload.ver) return res.status(401).json({ error: "Non connecté" });
      res.json({ email: user.email });
    })
  );

  /* ======================= Admin (protégé) ======================= */
  const admin = express.Router();
  admin.use(needDb, auth);

  admin.get(
    "/overview",
    h(async (_req, res) => {
      const [projects, messages, unread, uploads] = await Promise.all([
        Project.countDocuments(),
        Message.countDocuments(),
        Message.countDocuments({ read: false }),
        listUploads()
      ]);
      const profile = await Profile.findOne().lean();
      res.json({
        projects,
        messages,
        unread,
        uploads: uploads.length,
        experiences: profile?.experiences?.length ?? 0,
        updatedAt: (profile as { updatedAt?: Date } | null)?.updatedAt
      });
    })
  );

  // Profil (CV + tous les textes de la page)
  admin.get("/profile", h(async (_req, res) => res.json(await Profile.findOne().lean())));
  admin.put(
    "/profile",
    h(async (req, res) => {
      const parsed = profileSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Profil invalide", details: parsed.error.flatten() });
      const data = clean(parsed.data);
      const updated = await Profile.findOneAndReplace({}, data, { new: true, upsert: true, lean: true });
      res.json(updated);
    })
  );

  // Projets
  admin.get("/projects", h(async (_req, res) => res.json(await Project.find().sort({ order: 1 }).lean())));
  admin.post(
    "/projects",
    h(async (req, res) => {
      const parsed = projectSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Projet invalide" });
      if (await Project.exists({ slug: parsed.data.slug })) return res.status(409).json({ error: "Ce slug existe déjà" });
      const last = await Project.findOne().sort({ order: -1 }).lean();
      res.status(201).json(await Project.create({ ...parsed.data, order: (last?.order ?? 0) + 1 }));
    })
  );
  admin.put(
    "/projects/:id",
    h(async (req, res) => {
      const parsed = projectSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Projet invalide" });
      const clash = await Project.findOne({ slug: parsed.data.slug, _id: { $ne: req.params.id } }).lean();
      if (clash) return res.status(409).json({ error: "Ce slug existe déjà" });
      const updated = await Project.findOneAndReplace({ _id: req.params.id }, parsed.data, { new: true, lean: true });
      if (!updated) return res.status(404).json({ error: "Projet introuvable" });
      res.json(updated);
    })
  );
  admin.delete(
    "/projects/:id",
    h(async (req, res) => {
      const deleted = await Project.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Projet introuvable" });
      res.json({ ok: true });
    })
  );
  admin.put(
    "/projects-order",
    h(async (req, res) => {
      const ids = z.array(z.string()).safeParse(req.body?.ids);
      if (!ids.success) return res.status(400).json({ error: "Ordre invalide" });
      await Promise.all(ids.data.map((id, i) => Project.updateOne({ _id: id }, { order: i + 1 })));
      res.json(await Project.find().sort({ order: 1 }).lean());
    })
  );

  // Apparence
  admin.get("/settings", h(async (_req, res) => res.json((await Settings.findOne().lean()) ?? settingsSeed)));
  admin.put(
    "/settings",
    h(async (req, res) => {
      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Couleurs invalides (format #RRGGBB)" });
      res.json(await Settings.findOneAndUpdate({}, parsed.data, { new: true, upsert: true, lean: true }));
    })
  );

  // Messages reçus
  admin.get("/messages", h(async (_req, res) => res.json(await Message.find().sort({ createdAt: -1 }).lean())));
  admin.patch(
    "/messages/:id",
    h(async (req, res) => {
      const updated = await Message.findByIdAndUpdate(req.params.id, { read: Boolean(req.body?.read) }, { new: true, lean: true });
      if (!updated) return res.status(404).json({ error: "Message introuvable" });
      res.json(updated);
    })
  );
  admin.delete(
    "/messages/:id",
    h(async (req, res) => {
      await Message.findByIdAndDelete(req.params.id);
      res.json({ ok: true });
    })
  );

  // Médias
  admin.get("/uploads", h(async (_req, res) => res.json(await listUploads())));
  admin.delete(
    "/uploads",
    h(async (req, res) => {
      try {
        await deleteUpload(String(req.query.url ?? ""));
        res.json({ ok: true });
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 400;
        res.status(code).json({ error: code === 404 ? "Fichier introuvable" : (e as Error).message });
      }
    })
  );

  // Compte
  admin.put(
    "/account",
    h(async (req: AuthedRequest, res) => {
      const body = z
        .object({
          currentPassword: z.string().min(1),
          email: z.string().trim().email().optional(),
          newPassword: z.string().min(10, "Le nouveau mot de passe doit faire au moins 10 caractères").optional()
        })
        .safeParse(req.body);
      if (!body.success) return res.status(400).json({ error: body.error.issues[0]?.message ?? "Champs invalides" });
      const user = await User.findById(req.userId);
      if (!user || !verifyPassword(body.data.currentPassword, user.passwordHash)) {
        return res.status(401).json({ error: "Mot de passe actuel incorrect" });
      }
      if (body.data.email) user.email = body.data.email.toLowerCase();
      if (body.data.newPassword) {
        user.passwordHash = hashPassword(body.data.newPassword);
        user.sessionVersion += 1; // déconnecte les autres sessions
      }
      await user.save();
      setSessionCookie(res, createToken({ sub: user.id, ver: user.sessionVersion }));
      res.json({ email: user.email });
    })
  );

  // Remise à zéro du contenu (zone de danger)
  admin.post(
    "/reset-content",
    h(async (req, res) => {
      if (req.body?.confirm !== "REINITIALISER") return res.status(400).json({ error: "Confirmation manquante" });
      await runSeed();
      res.json({ ok: true });
    })
  );

  app.use("/api/admin", admin);

  app.use("/api", (_req, res) => res.status(404).json({ error: "Route inconnue" }));

  // En production, le même serveur sert le site (client/dist) : une seule adresse pour tout
  const clientDist = process.env.CLIENT_DIST ? path.resolve(process.env.CLIENT_DIST) : path.resolve(SERVER_DIR, "../../client/dist");
  if (existsSync(path.join(clientDist, "index.html"))) {
    app.use(
      express.static(clientDist, {
        index: false,
        setHeaders: (res, file) => {
          if (file.endsWith(".mjs")) res.setHeader("Content-Type", "text/javascript; charset=utf-8");
          // fichiers de build nommés par leur contenu : cache long ; le reste : revalidé
          res.setHeader("Cache-Control", file.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "public, max-age=3600");
        }
      })
    );
    app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { type?: string; status?: number; message?: string };
    if (e.type === "entity.too.large") return res.status(413).json({ error: "Fichier trop volumineux (200 Mo max)" });
    if (e.status === 404) return res.status(404).end();
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  });

  return app;
}
