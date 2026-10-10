/**
 * Envoi d'emails par API HTTP (Railway bloque le SMTP sortant sur la plupart des offres).
 *
 * Deux services au choix, configurés par variables d'environnement :
 *  - Brevo  : BREVO_API_KEY  — l'expéditeur peut être une simple adresse vérifiée (ex. Gmail) ;
 *  - Resend : RESEND_API_KEY — l'expéditeur doit appartenir à un domaine vérifié.
 * MAIL_FROM = adresse d'expédition, MAIL_FROM_NAME = nom affiché (facultatif).
 *
 * Sans configuration, rien n'est envoyé : l'admin affiche le lien à copier et transmettre soi-même.
 */

export function siteBase() {
  return (
    process.env.CLIENT_ORIGIN?.replace(/\/$/, "") ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:5173")
  );
}

export function mailConfigured() {
  return Boolean(process.env.MAIL_FROM && (process.env.BREVO_API_KEY || process.env.RESEND_API_KEY));
}

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Renvoie true si l'email est parti, false sinon (jamais d'exception). */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!mailConfigured()) return false;
  const from = process.env.MAIL_FROM!;
  const name = process.env.MAIL_FROM_NAME || "Valentin Busnel";
  try {
    const res = process.env.BREVO_API_KEY
      ? await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ sender: { email: from, name }, to: [{ email: mail.to }], subject: mail.subject, htmlContent: mail.html, textContent: mail.text })
        })
      : await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: `${name} <${from}>`, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text })
        });
    if (!res.ok) {
      console.warn(`⚠️  Email non envoyé à ${mail.to} (${res.status}) : ${(await res.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`⚠️  Email non envoyé à ${mail.to} :`, (e as Error).message);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Email d'invitation (ou de nouveau mot de passe), aux couleurs du site. */
export function inviteMail(opts: { to: string; link: string; role: "admin" | "viewer"; reset: boolean; days: number }): Mail {
  const access = opts.role === "admin" ? "administrateur" : "lecture seule";
  const subject = opts.reset ? "Choisissez votre nouveau mot de passe" : "Votre accès à l'espace d'administration";
  const intro = opts.reset
    ? "Voici un lien pour choisir un nouveau mot de passe pour l'espace d'administration du site de candidature de Valentin Busnel."
    : `Vous êtes invité(e) à rejoindre l'espace d'administration du site de candidature de Valentin Busnel, avec un accès <strong>${access}</strong>.`;
  const html = `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f7f7f7;font-family:Helvetica,Arial,sans-serif;color:#164951">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;padding:36px 32px" cellpadding="0" cellspacing="0">
<tr><td style="font-size:20px;font-weight:700;padding-bottom:22px">Valentin<span style="color:#176c79">.</span> <span style="font-size:13px;font-weight:500;color:#8aa4a8">admin</span></td></tr>
<tr><td style="font-size:22px;font-weight:700;line-height:30px;padding-bottom:12px">${esc(subject)}</td></tr>
<tr><td style="font-size:15px;line-height:23px;color:#6b8186;padding-bottom:26px">${intro}<br><br>Cliquez sur le bouton ci-dessous pour choisir votre mot de passe.</td></tr>
<tr><td style="padding-bottom:26px"><a href="${esc(opts.link)}" style="display:inline-block;background:#164951;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 24px;border-radius:12px">Choisir mon mot de passe</a></td></tr>
<tr><td style="font-size:12.5px;line-height:19px;color:#8aa4a8">Ce lien est personnel et valable ${opts.days} jours. Si le bouton ne fonctionne pas, copiez cette adresse :<br><a href="${esc(opts.link)}" style="color:#176c79;word-break:break-all">${esc(opts.link)}</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${subject}\n\n${intro.replace(/<[^>]+>/g, "")}\n\nChoisissez votre mot de passe ici (lien valable ${opts.days} jours) :\n${opts.link}\n`;
  return { to: opts.to, subject, html, text };
}
