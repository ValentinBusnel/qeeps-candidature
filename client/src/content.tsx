import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, type Profile } from "./api";

/**
 * Tous les petits textes du site (navigation, pied de page, formulaire, libellés des
 * vitrines, maquettes…) avec leur valeur d'origine. Chaque texte se modifie dans l'admin
 * (« Mon site » → « Textes du site ») ; une valeur vide revient au texte d'origine.
 *
 * Clé → [groupe, libellé dans l'admin, texte d'origine]
 */
export const TEXTS = {
  // Référencement
  "seo.title": ["seo", "Titre de l'onglet", "Candidature — Valentin Busnel pour Qeeps"],
  "seo.description": ["seo", "Description (moteurs de recherche)", "Candidature de Valentin Busnel, développeur Full Stack React / TypeScript, pour rejoindre l'équipe Qeeps."],

  // Barre de navigation
  "brand": ["nav", "Logo (texte)", "Valentin"],
  "nav.profil": ["nav", "Lien « Profil »", "Profil"],
  "nav.projets": ["nav", "Lien « Projets »", "Projets"],
  "nav.parcours": ["nav", "Lien « Parcours »", "Parcours"],
  "nav.login": ["nav", "Bouton de connexion", "Se connecter"],
  "nav.edit": ["nav", "Bouton une fois connecté", "Modifier mon site"],
  "nav.contact": ["nav", "Bouton de contact", "Me contacter"],

  // Pied de page
  "footer.text": ["footer", "Texte sous le logo", "Développeur Full Stack React / TypeScript, candidat pour rejoindre l'équipe Qeeps."],
  "footer.title": ["footer", "Titre de la colonne", "À propos"],
  "footer.about": ["footer", "Lien « À propos »", "À propos de ce site"],
  "footer.contact": ["footer", "Lien « Contact »", "Me contacter"],
  "footer.parcours": ["footer", "Lien « Parcours »", "Mon parcours"],
  "footer.legal": ["footer", "Mention en bas", "Candidature personnelle, non affiliée à Qeeps."],

  // Fenêtre de contact
  "contact.overline": ["contact", "Petit titre", "Pas encore convaincu ?"],
  "contact.title": ["contact", "Titre", "Planifions un échange"],
  "contact.name": ["contact", "Champ « Nom »", "Nom"],
  "contact.namePh": ["contact", "Exemple de nom", "Votre nom"],
  "contact.email": ["contact", "Champ « Email »", "Email"],
  "contact.emailPh": ["contact", "Exemple d'email", "vous@byqeeps.com"],
  "contact.message": ["contact", "Champ « Message »", "Message"],
  "contact.messagePh": ["contact", "Exemple de message", "Bonjour Valentin, échangeons sur le poste…"],
  "contact.send": ["contact", "Bouton d'envoi", "Envoyer mon message"],
  "contact.sending": ["contact", "Pendant l'envoi", "Envoi…"],
  "contact.sentTag": ["contact", "Étiquette après envoi", "Message envoyé"],
  "contact.sent": ["contact", "Message de remerciement", "Merci ! Je reviens vers vous très vite."],
  "contact.error": ["contact", "Ajout en cas d'erreur", "Vous pouvez aussi m'écrire directement par email."],

  // Fenêtre de connexion
  "login.title": ["login", "Titre", "Connexion"],
  "login.sub": ["login", "Sous-titre", "Accès à l'espace d'administration du site."],
  "login.email": ["login", "Champ « Email »", "Email"],
  "login.password": ["login", "Champ « Mot de passe »", "Mot de passe"],
  "login.submit": ["login", "Bouton", "Se connecter"],


  // Illustrations des blocs « Comment je travaille »
  "ill.mail": ["ill", "Nom de l'application des messages", "MAIL"],
  "ill.reply": ["ill", "Bouton des messages", "Répondre"],
  "ill.seeXp": ["ill", "Bouton des fiches d'expérience", "Voir cette expérience"],
  "ill.seeEdu": ["ill", "Bouton des fiches de formation", "Voir cette formation"],
  "ill.stack": ["ill", "Lien sous les tuiles", "+ Voir toute ma stack"],
  "ill.xp": ["ill", "Fiche : titre", "Expérience"],
  "ill.since": ["ill", "Fiche : « en production depuis »", "En production depuis"],
  "ill.card": ["ill", "Carte : en-tête", "Certifié"],
  "ill.identity": ["ill", "Carte : « Identité »", "Identité"],
  "ill.training": ["ill", "Carte : « Formation »", "Formation"],
  "ill.promo": ["ill", "Carte : « Promo »", "Promo"],

  // Expériences
  "xp.summary": ["xp", "Titre « En bref »", "En bref"],
  "xp.env": ["xp", "Titre « Environnement »", "Environnement"],
  "xp.years": ["xp", "Unité « ans »", "ans"],
  "xp.year": ["xp", "Unité « an »", "an"],
  "xp.months": ["xp", "Unité « mois »", "mois"],
  "xp.inPost": ["xp", "Sous la durée", "en poste"],

  // Projets
  "proj.stack": ["proj", "Titre « Stack »", "Stack"],
  "proj.next": ["proj", "« Projet suivant »", "Projet suivant"],
  "proj.prev": ["proj", "« Projet précédent »", "Projet précédent"],
  "proj.discover": ["proj", "Lien du projet suivant", "Découvrir"],
  "proj.expand": ["proj", "Bouton « Agrandir »", "Agrandir"],
  "proj.empty": ["proj", "Projet sans média", "Ajoute des photos ou vidéos depuis l'admin"],
  "cine.play": ["proj", "Mode cinéma : « lecture »", "lecture"],
  "cine.media": ["proj", "Mode cinéma : « médias »", "médias"],
  "cine.full": ["proj", "Mode cinéma : « plein écran »", "plein écran"],
  "cine.quit": ["proj", "Mode cinéma : « quitter »", "quitter"],

  // Ma candidature
  "docs.open": ["docs", "Bouton des cartes", "Ouvrir"],
  "docs.download": ["docs", "Bouton de téléchargement", "Télécharger"],
  "docs.error": ["docs", "Document illisible", "Impossible d'afficher ce document ici."],
  "docs.fallback": ["docs", "Lien de secours", "Ouvrir le PDF"],

  // Atouts
  "reasons.by": ["reasons", "Signature des cartes", "Valentin"],

  // Chargement
  "state.loading": ["state", "Pendant le chargement", "Chargement du dossier…"]
} as const satisfies Record<string, readonly [string, string, string]>;

export type TextKey = keyof typeof TEXTS;

export const TEXT_GROUPS: { id: string; label: string; hint: string }[] = [
  { id: "seo", label: "Référencement", hint: "Le titre de l'onglet du navigateur et la description lue par Google." },
  { id: "nav", label: "Barre de navigation", hint: "Le logo, les liens et les boutons en haut du site." },
  { id: "footer", label: "Pied de page", hint: "Le bloc pétrole tout en bas du site." },
  { id: "contact", label: "Fenêtre de contact", hint: "Ce qui s'ouvre avec « Me contacter »." },
  { id: "login", label: "Fenêtre de connexion", hint: "Ce qui s'ouvre avec « Se connecter »." },
  { id: "ill", label: "Illustrations des blocs", hint: "Les petits textes dans les illustrations de « Comment je travaille »." },
  { id: "xp", label: "Expériences", hint: "Les libellés autour des postes." },
  { id: "proj", label: "Projets", hint: "Les libellés de la vitrine et de la fiche projet." },
  { id: "docs", label: "Ma candidature", hint: "Les boutons des cartes et de la liseuse des documents." },
  { id: "reasons", label: "Ce que j'apporte", hint: "La signature sous chaque carte." },
  { id: "state", label: "Messages du site", hint: "Ce qui s'affiche pendant un chargement." }
];

export const textDefault = (k: TextKey) => TEXTS[k][2];

/** Texte affiché : la valeur modifiée si elle existe, sinon le texte d'origine. */
export function resolveText(texts: Record<string, string> | undefined, k: TextKey) {
  const v = texts?.[k];
  return v !== undefined && v.trim() !== "" ? v : TEXTS[k][2];
}

/* ---------------------------------------------------------------------
   Contexte du site public : le profil, partagé par la navigation, le pied
   de page et les fenêtres. En aperçu (admin), il suit le brouillon en direct.
   --------------------------------------------------------------------- */
const SiteContext = createContext<{ profile: Profile | null; t: (k: TextKey) => string }>({
  profile: null,
  t: (k) => TEXTS[k][2]
});

export const useSite = () => useContext(SiteContext);

const IN_PREVIEW = typeof window !== "undefined" && window.parent !== window && new URLSearchParams(location.search).has("apercu");

export function SiteProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    api.profile().then(setProfile).catch(() => {});
  }, []);

  useEffect(() => {
    if (!IN_PREVIEW) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin === location.origin && e.source === window.parent && e.data?.type === "qeeps:draft") setProfile(e.data.profile as Profile);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const t = useCallback((k: TextKey) => resolveText(profile?.texts, k), [profile]);

  // titre de l'onglet et description
  useEffect(() => {
    if (!profile) return;
    document.title = t("seo.title");
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = t("seo.description");
  }, [profile, t]);

  const value = useMemo(() => ({ profile, t }), [profile, t]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
