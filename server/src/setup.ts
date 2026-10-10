import crypto from "node:crypto";

/**
 * Première connexion : créer son compte admin directement depuis le site, sans mettre
 * de mot de passe dans les variables d'environnement.
 *
 * Le site étant public, n'importe qui pourrait sinon « réserver » l'admin avant toi.
 * Tant qu'aucun compte n'existe, le serveur génère donc une clé secrète à usage unique
 * et l'affiche dans ses journaux (Railway → Deployments → View logs) sous forme de lien.
 * Seule la personne qui a accès aux journaux peut créer le compte.
 */
let setupKey: string | null = null;

export function prepareSetup() {
  setupKey = crypto.randomBytes(24).toString("base64url");
  const base =
    process.env.CLIENT_ORIGIN?.replace(/\/$/, "") ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:5173");
  console.log("");
  console.log("🔑 Aucun compte admin pour l'instant. Pour créer le tien, ouvre ce lien (valable jusqu'au prochain redémarrage) :");
  console.log(`   ${base}/admin/connexion?cle=${setupKey}`);
  console.log("");
}

/** Vérifie la clé (comparaison à temps constant). */
export function checkSetupKey(key: string) {
  if (!setupKey || !key) return false;
  const a = Buffer.from(setupKey);
  const b = Buffer.from(key);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** La clé ne sert qu'une fois. */
export function consumeSetupKey() {
  setupKey = null;
}
