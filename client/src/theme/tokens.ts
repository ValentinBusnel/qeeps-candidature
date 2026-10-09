/**
 * Source unique de la charte graphique.
 * Ces valeurs alimentent les variables CSS (applyTokens).
 * Les couleurs "verified" ont été mesurées au pixel sur byqeeps.com.
 */

export type ColorToken = {
  name: string;
  cssVar: string;
  value: string;
  usage: string;
  verified: boolean;
};

export const colors: { group: string; tokens: ColorToken[] }[] = [
  {
    group: "Marque",
    tokens: [
      { name: "Pétrole", cssVar: "--color-primary", value: "#164951", usage: "Boutons, titres, liens, footer", verified: true },
      { name: "Pétrole clair", cssVar: "--color-primary-light", value: "#176C79", usage: "Fin du dégradé des grands titres et chiffres", verified: true },
      { name: "Pétrole profond", cssVar: "--color-deep", value: "#164951", usage: "Footer, cartes sombres", verified: true },
      { name: "Turquoise doux", cssVar: "--color-cyan-soft", value: "#DDF7F7", usage: "Fonds de tags et pastilles", verified: true }
    ]
  },
  {
    group: "Texte",
    tokens: [
      { name: "Encre", cssVar: "--color-ink", value: "#164951", usage: "Titres et texte fort", verified: true },
      { name: "Gris sauge", cssVar: "--color-muted", value: "#8AA4A8", usage: "Overlines, sous-titres, descriptions", verified: true },
      { name: "Gris doux", cssVar: "--color-subtle", value: "#6B8186", usage: "Paragraphes longs (meilleur contraste)", verified: false }
    ]
  },
  {
    group: "Surfaces",
    tokens: [
      { name: "Fond", cssVar: "--color-bg", value: "#F7F7F7", usage: "Fond de page", verified: true },
      { name: "Navigation", cssVar: "--color-nav", value: "#F8F8F8", usage: "Barre de navigation", verified: true },
      { name: "Carte", cssVar: "--color-surface", value: "#FFFFFF", usage: "Cartes, mails, tuiles", verified: true },
      { name: "Bloc", cssVar: "--color-block", value: "#F2F3F4", usage: "Blocs de fonctionnalités", verified: true },
      { name: "Tuile active", cssVar: "--color-tile", value: "#E1E6E7", usage: "Tuile mise en avant, carte arrière, tags", verified: true },
      { name: "Bordure", cssVar: "--color-border", value: "#E1E6E7", usage: "Bordure des boutons secondaires", verified: true }
    ]
  },
  {
    group: "États",
    tokens: [
      { name: "Vert", cssVar: "--color-success", value: "#6EB382", usage: "Garant, validé", verified: true },
      { name: "Vert doux", cssVar: "--color-success-soft", value: "#D1EDE0", usage: "Fond des éléments « ajouter »", verified: true },
      { name: "Rose source", cssVar: "--color-source", value: "#F3DDE2", usage: "Étiquette de source (SeLoger)", verified: true },
      { name: "Erreur", cssVar: "--color-danger", value: "#D64545", usage: "Messages d'erreur", verified: false }
    ]
  }
];

export const fontFamily = `"Poppins", "Poppins Placeholder", sans-serif`;

export type TypeToken = {
  name: string;
  className: string;
  size: number;
  lineHeight: number;
  weight: number;
  verified: boolean;
};

export const typeScale: TypeToken[] = [
  { name: "Display / H1", className: "t-h1", size: 52, lineHeight: 62.4, weight: 700, verified: true },
  { name: "Chiffre clé", className: "t-stat", size: 62, lineHeight: 74.4, weight: 700, verified: true },
  { name: "H2 de section", className: "t-h2", size: 36, lineHeight: 49, weight: 600, verified: true },
  { name: "H3 de bloc", className: "t-h3", size: 24, lineHeight: 28.8, weight: 600, verified: true },
  { name: "Overline", className: "t-overline", size: 18, lineHeight: 21.6, weight: 500, verified: true },
  { name: "Description / sous-titre", className: "t-sub", size: 16, lineHeight: 19.2, weight: 500, verified: true },
  { name: "Lien de navigation", className: "t-nav", size: 15, lineHeight: 30, weight: 500, verified: true },
  { name: "Témoignage", className: "t-quote", size: 14, lineHeight: 22.4, weight: 500, verified: true }
];

export const spacing = [4, 6, 8, 10, 16, 24, 30, 48, 56, 60, 72, 96];

export const radii = [
  { name: "xs", cssVar: "--radius-xs", value: 6, usage: "Petits boutons de cartes, étiquettes" },
  { name: "md", cssVar: "--radius-md", value: 8, usage: "Boutons" },
  { name: "lg", cssVar: "--radius-lg", value: 10, usage: "Cartes mail" },
  { name: "xl", cssVar: "--radius-xl", value: 20, usage: "Cartes témoignage, carte certifiée" },
  { name: "block", cssVar: "--radius-block", value: 24, usage: "Blocs de fonctionnalités" }
];

/** Ombres « longues » de Framer, relevées sur les cartes de byqeeps.com. */
export const shadows = [
  { name: "btn", cssVar: "--shadow-btn", value: "rgba(0,0,0,.024) 0 .15px .73px, rgba(0,0,0,.04) 0 .66px 1.5px, rgba(0,0,0,.05) 0 1.62px 3px, rgba(0,0,0,.06) 0 3.12px 5.87px, rgba(0,0,0,.075) 0 5.26px 10.8px, rgba(0,0,0,.1) 0 8.1px 18.4px" },
  { name: "card", cssVar: "--shadow-card", value: "rgba(0,0,0,.016) 0 1.85px 3.15px, rgba(0,0,0,.027) 0 8.15px 6.52px, rgba(0,0,0,.035) 0 20px 13px, rgba(0,0,0,.043) 0 38.5px 25.5px, rgba(0,0,0,.055) 0 64.8px 46.9px, rgba(0,0,0,.07) 0 100px 80px" },
  { name: "quote", cssVar: "--shadow-quote", value: "rgba(0,0,0,.18) 0 .6px .6px -1.25px, rgba(0,0,0,.16) 0 2.29px 2.29px -2.5px, rgba(0,0,0,.06) 0 10px 10px -3.75px" },
  { name: "hero", cssVar: "--shadow-hero", value: "rgba(0,0,0,.2) 0 -49px 70px -48px" }
];

export const motion = [
  { name: "Apparition du hero", detail: "opacité 0 → 1 et montée de 20 px (titre), 50 px (boutons), 70 px (maquette)", duration: "1,1 s · 1 s · 1,6 s", easing: "cubic-bezier(.02, .45, .56, 1)" },
  { name: "Apparition des chiffres", detail: "opacité 0 → 1, montée de 20 px quand ils entrent dans l'écran", duration: "1,1 s", easing: "cubic-bezier(.02, .45, .56, 1)" },
  { name: "Survol des blocs", detail: "le visuel s'anime au survol : pile de mails, tuile qui s'agrandit, fiches qui s'écartent", duration: "0,6 s", easing: "cubic-bezier(.44, 0, .56, 1)" },
  { name: "Défilement infini", detail: "logos et cartes, bords en fondu, pause au survol", duration: "25 px/s", easing: "linear" },
  { name: "Inclinaison du hero", detail: "la maquette pivote de 0,6° vers le curseur", duration: "0,4 s", easing: "ease-out" }
];

/** Couleurs par défaut + surcharges enregistrées depuis l'admin (onglet Apparence). */
export function resolveColors(overrides: Record<string, string> = {}) {
  return colors.map((g) => ({
    ...g,
    tokens: g.tokens.map((t) => (overrides[t.cssVar] ? { ...t, value: overrides[t.cssVar], verified: false } : t))
  }));
}

/** Injecte les tokens en variables CSS sur :root. */
export function applyTokens(overrides: Record<string, string> = {}, root: HTMLElement = document.documentElement) {
  resolveColors(overrides)
    .flatMap((g) => g.tokens)
    .forEach((t) => root.style.setProperty(t.cssVar, t.value));
  radii.forEach((r) => root.style.setProperty(r.cssVar, `${r.value}px`));
  shadows.forEach((s) => root.style.setProperty(s.cssVar, s.value));
  root.style.setProperty("--font-family", fontFamily);
}
