import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Authentification sans dépendance externe :
 * - mots de passe hachés avec scrypt (sel aléatoire, comparaison à temps constant) ;
 * - session = jeton signé HMAC-SHA256 stocké dans un cookie httpOnly.
 */

const COOKIE = "qc_session";
const SESSION_DAYS = 7;

let secret = process.env.SESSION_SECRET ?? "";
if (secret.length < 32) {
  secret = crypto.randomBytes(48).toString("hex");
  console.warn(
    "⚠️  SESSION_SECRET absent ou trop court dans server/.env : un secret temporaire est utilisé " +
      "(tu seras déconnecté à chaque redémarrage du serveur)."
  );
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

interface SessionPayload {
  sub: string; // id de l'utilisateur
  ver: number; // version de session : changer le mot de passe invalide les anciennes sessions
  exp: number;
}

function sign(data: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export function createToken(payload: Omit<SessionPayload, "exp">) {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + SESSION_DAYS * 86_400_000 })
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export function getCookie(req: Request, name = COOKIE) {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 86_400_000,
    path: "/"
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE, { path: "/" });
}

/* ---------- Limitation des tentatives de connexion ---------- */
const attempts = new Map<string, { count: number; until: number }>();

export function loginAllowed(ip: string) {
  const a = attempts.get(ip);
  return !a || a.until < Date.now() || a.count < 5;
}

export function recordLoginFailure(ip: string) {
  const a = attempts.get(ip);
  if (!a || a.until < Date.now()) attempts.set(ip, { count: 1, until: Date.now() + 15 * 60_000 });
  else a.count += 1;
}

export function resetLoginFailures(ip: string) {
  attempts.delete(ip);
}

/* ---------- Middlewares ---------- */
export type AuthedRequest = Request & { userId?: string; userRole?: "admin" | "viewer" };

/**
 * Protège les routes admin. La vérification de la version de session
 * se fait dans `loadUser` (passé par app.ts) pour éviter une dépendance circulaire.
 */
export function requireAuth(loadUser: (id: string) => Promise<{ sessionVersion: number; role?: "admin" | "viewer"; passwordHash?: string } | null>) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    // En-tête exigé sur les requêtes qui modifient : bloque les formulaires cross-site (CSRF)
    if (req.method !== "GET" && req.get("X-Requested-With") !== "admin") {
      return res.status(403).json({ error: "Requête refusée" });
    }
    const payload = readToken(getCookie(req));
    if (!payload) return res.status(401).json({ error: "Non connecté" });
    const user = await loadUser(payload.sub);
    if (!user || !user.passwordHash || user.sessionVersion !== payload.ver) return res.status(401).json({ error: "Session expirée" });
    req.userId = payload.sub;
    req.userRole = user.role ?? "admin"; // les comptes créés avant les rôles sont administrateurs
    next();
  };
}

/** Les comptes « lecture seule » consultent tout mais ne modifient rien. */
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.userRole === "admin") return next();
  res.status(403).json({ error: "Votre accès est en lecture seule" });
}
