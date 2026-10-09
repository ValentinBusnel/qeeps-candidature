import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { AboutContent, AppDoc, Experience, Heading, Profile, Project, Sections } from "../api";
import { ABOUT_DEFAULT } from "../components/SiteModals";
import { TEXTS, TEXT_GROUPS, textDefault, type TextKey } from "../content";
import { Icon } from "../components/Icons";
import { Card, FileField, Grid, LinesField, NumberField, Repeater, Select, TagsField, TextArea, TextField } from "./ui";

/**
 * Le site, section par section, dans l'ordre où on le lit. Chaque entrée sait :
 * où elle se trouve sur la page (pour l'aperçu en direct), ce qu'elle contient
 * (pour le résumé du tableau de bord) et quelles données elle touche (pour signaler
 * les sections modifiées mais pas encore publiées).
 */
export type SetProfile = <K extends keyof Profile>(key: K, value: Profile[K]) => void;

export interface SectionDef {
  id: string;
  label: string;
  /** endroit du site montré dans l'aperçu ("top", "#id", "modal:…", "nav", "footer") */
  target: string;
  hint: string;
  /** icône et teinte de la section (palette Qeeps : turquoise, vert, rose, sable) */
  icon: string;
  tone: "cyan" | "green" | "pink" | "sand";
  summary: (p: Profile) => string;
  pick: (p: Profile) => unknown;
  Editor: (props: { p: Profile; set: SetProfile; projects?: Project[] }) => ReactNode;
  /** toujours affichée (pas d'interrupteur « Afficher sur le site ») */
  fixed?: boolean;
}

const ICONS = [
  "rocket", "code", "users", "database", "server", "check", "badge", "briefcase", "graduation",
  "globe", "mail", "palette", "gear", "clock", "pin", "user", "home", "folder", "image",
  "info", "star", "phone", "send", "layers", "chart", "lock", "eye"
].map((v) => ({ value: v, label: v }));

/** Où se trouve chaque groupe de textes sur le site (pour l'aperçu). */
const GROUP_TARGETS: Record<string, string> = {
  seo: "top",
  nav: "nav",
  footer: "footer",
  contact: "modal:contact",
  login: "modal:login",
  ill: "#methode",
  xp: "#parcours",
  proj: "#projets",
  reasons: "#atouts",
  docs: "#candidature",
  state: "top"
};

/** Position du premier bloc qui utilise une illustration donnée. */
const VISUALS = ["mails", "tiles", "people", "cert", "docs"] as const;
function visualIndex(blocks: { visual?: string }[], v: (typeof VISUALS)[number]) {
  const i = blocks.findIndex((b, k) => (b.visual ?? VISUALS[k % 4]) === v);
  return Math.max(0, i);
}

const RICH_HINT = "Entourez un mot de **doubles astérisques** pour le mettre en couleur.";

/** Titre de section du site : petit texte gris + grand titre. */
function HeadingFields({ value, onChange, second = false }: { value: Heading; onChange: (h: Heading) => void; second?: boolean }) {
  return (
    <Card title="Titre de la section">
      <Grid cols={second ? 3 : 2}>
        <TextField label="Petit titre" value={value.overline} onChange={(v) => onChange({ ...value, overline: v })} />
        <TextField label="Grand titre" value={value.title} onChange={(v) => onChange({ ...value, title: v })} />
        {second && <TextField label="Grand titre, 2e ligne" value={value.titleSecondLine} onChange={(v) => onChange({ ...value, titleSecondLine: v })} />}
      </Grid>
    </Card>
  );
}

const setSection = (p: Profile, set: SetProfile) => <K extends keyof Sections>(key: K, value: Sections[K]) =>
  set("sections", { ...p.sections, [key]: value });

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

export const SECTIONS: SectionDef[] = [
  {
    id: "accueil",
    label: "Haut de page",
    fixed: true,
    target: "top",
    hint: "La première chose qu'on voit : le grand titre et ses deux boutons.",
    icon: "home",
    tone: "cyan",
    summary: (p) => `${p.hero.titleTop} ${p.hero.titleBottom}`,
    pick: (p) => [p.hero, p.sections.heroButtons],
    Editor: ({ p, set }) => {
      const setS = setSection(p, set);
      return (
        <>
          <Card title="Grand titre" preview="#hero-title">
            <Grid>
              <TextField label="Ligne 1" value={p.hero.titleTop} onChange={(v) => set("hero", { ...p.hero, titleTop: v })} />
              <TextField label="Ligne 2" value={p.hero.titleBottom} onChange={(v) => set("hero", { ...p.hero, titleBottom: v })} />
            </Grid>
            <TextArea label="Texte sous le titre" rows={3} value={p.hero.subtitle} onChange={(v) => set("hero", { ...p.hero, subtitle: v })} />
          </Card>
          <Card title="Boutons" preview="#hero-actions">
            <Grid>
              <TextField label="Bouton blanc (À propos)" value={p.sections.heroButtons.secondary} onChange={(v) => setS("heroButtons", { ...p.sections.heroButtons, secondary: v })} />
              <TextField label="Bouton plein (Contact)" value={p.sections.heroButtons.primary} onChange={(v) => setS("heroButtons", { ...p.sections.heroButtons, primary: v })} />
            </Grid>
          </Card>
        </>
      );
    }
  },
  {
    id: "stack",
    label: "Stack technique",
    target: "#stack",
    hint: "Le défilé de logos de vos technologies.",
    icon: "code",
    tone: "green",
    summary: (p) => plural(p.skills.flatMap((s) => s.items).length, "technologie"),
    pick: (p) => [p.sections.stack, p.skills],
    Editor: ({ p, set }) => (
      <>
        <HeadingFields value={p.sections.stack} onChange={(v) => setSection(p, set)("stack", v)} />
        <Card title="Technologies" description="Tapez un nom puis Entrée. Glissez une étiquette pour la déplacer.">
          <Repeater
            items={p.skills}
            onChange={(v) => set("skills", v)}
            defaultOpen
            itemTitle={(g) => `${g.category} · ${g.items.length}`}
            create={() => ({ category: "Nouvelle catégorie", items: [] })}
            addLabel="Ajouter une catégorie"
            render={(g, up) => (
              <>
                <TextField label="Catégorie" value={g.category} onChange={(v) => up({ category: v })} />
                <TagsField label="Technologies" value={g.items} onChange={(v) => up({ items: v })} />
              </>
            )}
          />
        </Card>
      </>
    )
  },
  {
    id: "profil",
    label: "Qui suis-je ?",
    target: "#profil",
    hint: "Votre carte de visite et votre présentation.",
    icon: "user",
    tone: "pink",
    summary: (p) => `${p.fullName} · ${p.title}`,
    pick: (p) => [p.sections.profile, p.fullName, p.firstName, p.title, p.location, p.avatarUrl, p.summary],
    Editor: ({ p, set }) => (
      <>
        <HeadingFields value={p.sections.profile} onChange={(v) => setSection(p, set)("profile", v)} />
        <Card title="Carte de visite" preview="#profil-card">
          <Grid>
            <TextField label="Nom complet" value={p.fullName} onChange={(v) => set("fullName", v)} />
            <TextField label="Prénom" value={p.firstName} onChange={(v) => set("firstName", v)} />
            <TextField label="Métier" value={p.title} onChange={(v) => set("title", v)} />
            <TextField label="Ville" value={p.location} onChange={(v) => set("location", v)} />
          </Grid>
          <FileField label="Photo (carrée)" value={p.avatarUrl ?? ""} onChange={(v) => set("avatarUrl", v)} folder="avatar" accept="image/*" hint="Sans photo, vos initiales s'affichent." />
        </Card>
        <Card title="Présentation" description="Le premier paragraphe est écrit en plus grand." preview="#profil-text">
          <LinesField label="Paragraphes" multiline value={p.summary} onChange={(v) => set("summary", v)} addLabel="Ajouter un paragraphe" />
        </Card>
      </>
    )
  },
  {
    id: "experiences",
    label: "Expériences",
    target: "#parcours",
    hint: "Les postes qu'on fait défiler, avec leurs missions.",
    icon: "briefcase",
    tone: "sand",
    summary: (p) => p.experiences.map((x) => x.company).join(" · ") || "Aucune expérience",
    pick: (p) => [p.sections.parcours, p.experiences],
    Editor: ({ p, set }) => (
      <>
        <HeadingFields value={p.sections.parcours} onChange={(v) => setSection(p, set)("parcours", v)} />
        <Card title="Postes" description="Dans l'ordre d'affichage. Ouvrez un poste pour le modifier.">
          <Repeater<Experience>
            items={p.experiences}
            itemPreview={(x) => `xp:${x.id}`}
            onChange={(v) => set("experiences", v)}
            itemTitle={(x) => `${x.company} · ${x.role}`}
            create={() => ({
              id: `xp-${Date.now()}`,
              company: "Entreprise",
              role: "Poste",
              contract: "CDI",
              period: "",
              mode: "",
              summary: "",
              groups: [{ title: "Missions", bullets: [] }],
              env: []
            })}
            addLabel="Ajouter un poste"
            render={(x, up) => (
              <>
                <Grid>
                  <TextField label="Entreprise" value={x.company} onChange={(v) => up({ company: v })} />
                  <TextField label="Poste" value={x.role} onChange={(v) => up({ role: v })} />
                </Grid>
                <Grid cols={3}>
                  <TextField label="Contrat" value={x.contract} onChange={(v) => up({ contract: v })} />
                  <TextField label="Période" placeholder="Oct. 2023 – Fév. 2026" value={x.period} onChange={(v) => up({ period: v })} />
                  <TextField label="Rythme" placeholder="Hybride" value={x.mode} onChange={(v) => up({ mode: v })} />
                </Grid>
                <TextArea label="En bref" rows={2} value={x.summary} onChange={(v) => up({ summary: v })} />
                <FileField label="Logo (optionnel)" value={x.logoUrl ?? ""} onChange={(v) => up({ logoUrl: v || undefined })} folder="logos" accept="image/*" />
                <p className="adm-label">Missions, par onglet</p>
                <Repeater
                  items={x.groups}
                  onChange={(groups) => up({ groups })}
                  itemTitle={(g) => `${g.title} · ${g.bullets.length}`}
                  create={() => ({ title: "Nouvel onglet", bullets: [] })}
                  addLabel="Ajouter un onglet"
                  render={(g, upG) => (
                    <>
                      <TextField label="Nom de l'onglet" value={g.title} onChange={(v) => upG({ title: v })} />
                      <LinesField label="Missions" value={g.bullets} onChange={(v) => upG({ bullets: v })} addLabel="Ajouter une mission" />
                    </>
                  )}
                />
                <TagsField label="Outils utilisés" value={x.env} onChange={(v) => up({ env: v })} />
              </>
            )}
          />
        </Card>
      </>
    )
  },
  {
    id: "methode",
    label: "Comment je travaille",
    target: "#methode",
    hint: "Les grands blocs gris animés, chacun avec son illustration.",
    icon: "rocket",
    tone: "cyan",
    summary: (p) => `${plural(p.sections.features.blocks.length, "bloc")} · ${plural(p.education.length, "formation")}`,
    pick: (p) => [p.sections.features, p.education],
    Editor: ({ p, set }) => {
      const f = p.sections.features;
      const setF = (patch: Partial<typeof f>) => setSection(p, set)("features", { ...f, ...patch });
      return (
        <>
          <HeadingFields second value={f} onChange={(v) => setF(v)} />
          <Card title="Blocs" description="Chaque bloc choisit son illustration.">
            <Repeater
              items={f.blocks}
              itemPreview={(_, i) => `#bloc-${i}`}
              onChange={(blocks) => setF({ blocks })}
              itemTitle={(b) => b.title}
              create={(): (typeof f.blocks)[number] => ({ title: "Nouveau bloc", text: "" })}
              addLabel="Ajouter un bloc"
              render={(b, up, i) => (
                <>
                  <TextField label="Titre" value={b.title} onChange={(v) => up({ title: v })} />
                  <TextArea label="Texte" rows={3} value={b.text} onChange={(v) => up({ text: v })} hint={RICH_HINT} />
                  <Select
                    label="Illustration"
                    value={b.visual ?? (["mails", "tiles", "people", "cert"] as const)[i % 4]}
                    onChange={(v) => up({ visual: v as "mails" | "tiles" | "people" | "cert" | "docs" })}
                    options={[
                      { value: "mails", label: "Messages qui défilent" },
                      { value: "tiles", label: "Tuiles de compétences" },
                      { value: "people", label: "Fiches d'expériences et de formations" },
                      { value: "cert", label: "Cartes de formation" },
                      { value: "docs", label: "Documents de candidature (CV, lettres…)" }
                    ]}
                  />
                </>
              )}
            />
          </Card>
          <Card title="Messages qui défilent" description="Illustration « Messages qui défilent »." preview={`#bloc-${visualIndex(f.blocks, "mails")}`}>
            <Repeater
              items={f.messages}
              onChange={(messages) => setF({ messages })}
              itemTitle={(m) => `${m.from} · ${m.source}`}
              create={() => ({ from: "Expéditeur", source: "Étiquette", text: "" })}
              addLabel="Ajouter un message"
              render={(m, up) => (
                <>
                  <Grid>
                    <TextField label="De" value={m.from} onChange={(v) => up({ from: v })} />
                    <TextField label="Étiquette rose" value={m.source} onChange={(v) => up({ source: v })} />
                  </Grid>
                  <TextArea label="Message" rows={2} value={m.text} onChange={(v) => up({ text: v })} />
                </>
              )}
            />
          </Card>
          <Card title="Tuiles" description="Illustration « Tuiles » (3 au maximum)." preview={`#bloc-${visualIndex(f.blocks, "tiles")}`}>
            <Repeater
              items={f.tiles}
              onChange={(tiles) => setF({ tiles: tiles.slice(0, 3) })}
              itemTitle={(t) => `${t.value} ${t.unit} · ${t.label}`}
              create={() => ({ icon: "code", value: "", unit: "", label: "" })}
              addLabel="Ajouter une tuile"
              render={(t, up) => (
                <Grid>
                  <TextField label="Valeur" value={t.value} onChange={(v) => up({ value: v })} />
                  <TextField label="Unité" value={t.unit} onChange={(v) => up({ unit: v })} />
                  <TextField label="Libellé" value={t.label} onChange={(v) => up({ label: v })} />
                  <Select label="Icône" value={t.icon} onChange={(v) => up({ icon: v })} options={ICONS} />
                </Grid>
              )}
            />
          </Card>
          <Card
            title="Formations"
            description="Illustration « Cartes de formation » : une carte par formation, un clic sur le site la fait passer devant."
            preview={`#bloc-${visualIndex(f.blocks, "cert")}`}
          >
            <Repeater
              items={p.education}
              itemPreview={(_, i) => `#edu-${i}`}
              onChange={(v) => set("education", v)}
              itemTitle={(e) => `${e.school} · ${e.title}`}
              create={() => ({ school: "École", title: "Formation", period: "", description: "", tags: [], badge: "" })}
              addLabel="Ajouter une formation"
              render={(e, up) => (
                <>
                  <Grid>
                    <TextField label="École" value={e.school} onChange={(v) => up({ school: v })} />
                    <TextField label="Intitulé" value={e.title} onChange={(v) => up({ title: v })} />
                  </Grid>
                  <Grid>
                    <TextField label="Années" value={e.period} onChange={(v) => up({ period: v })} hint="Une année (ex. 2021) s'affiche « Promo 2021 »." />
                    <TextField label="Badge de la carte" value={e.badge ?? ""} onChange={(v) => up({ badge: v })} hint="Ex. « Certifié ». Vide : pas de badge." />
                  </Grid>
                  <TagsField label="Étiquettes" value={e.tags} onChange={(v) => up({ tags: v })} />
                </>
              )}
            />
          </Card>
        </>
      );
    }
  },
  {
    id: "candidature",
    label: "Ma candidature",
    target: "#candidature",
    hint: "Le bloc du dossier : CV, lettre de recommandation et lettre de motivation, chacun ouvert dans une liseuse.",
    icon: "folder",
    tone: "pink",
    summary: (p) => {
      const docs = p.documents ?? [];
      return docs.length ? docs.map((d) => d.label).join(" · ") : "Aucun document";
    },
    pick: (p) => [p.documents, p.sections.features.blocks.find((b) => b.visual === "docs")],
    Editor: ({ p, set }) => {
      const f = p.sections.features;
      const at = f.blocks.findIndex((b) => b.visual === "docs");
      const setBlock = (patch: Partial<(typeof f.blocks)[number]>) =>
        setSection(p, set)("features", { ...f, blocks: f.blocks.map((b, i) => (i === at ? { ...b, ...patch } : b)) });
      const docs = p.documents ?? [];
      return (
        <>
          <Card title="Le bloc" description="Il s'affiche à la suite des blocs de « Comment je travaille »." preview="#candidature">
            {at >= 0 ? (
              <>
                <TextField label="Titre" value={f.blocks[at].title} onChange={(v) => setBlock({ title: v })} />
                <TextArea label="Texte" rows={3} value={f.blocks[at].text} onChange={(v) => setBlock({ text: v })} hint={RICH_HINT} />
              </>
            ) : (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() =>
                  setSection(p, set)("features", {
                    ...f,
                    blocks: [...f.blocks, { title: "Ma candidature", text: "Mon CV, mes lettres : **tout mon dossier**, à portée de clic.", visual: "docs" }]
                  })
                }
              >
                <Icon name="plus" /> Ajouter le bloc à la page
              </button>
            )}
          </Card>
          <Card title="Documents" description="Une carte par document. Un PDF s'affiche page par page ; une lettre se rédige ici et s'écrit sous les yeux du lecteur.">
            <Repeater<AppDoc>
              items={docs}
              onChange={(v) => set("documents", v)}
              itemPreview={(d) => `doc:${d.id}`}
              itemTitle={(d) => `${d.label} · ${d.title}`}
              create={() => ({ id: `doc-${Date.now().toString(36)}`, kind: "pdf", label: "Document", title: "Nouveau document", caption: "", tone: "cyan" })}
              addLabel="Ajouter un document"
              render={(d, up) => (
                <>
                  <Grid>
                    <Select
                      label="Type"
                      value={d.kind}
                      onChange={(v) => up({ kind: v as AppDoc["kind"] })}
                      options={[
                        { value: "pdf", label: "Fichier PDF" },
                        { value: "letter", label: "Lettre rédigée sur le site" }
                      ]}
                    />
                    <Select
                      label="Couleur"
                      value={d.tone}
                      onChange={(v) => up({ tone: v as AppDoc["tone"] })}
                      options={[
                        { value: "cyan", label: "Turquoise" },
                        { value: "green", label: "Vert" },
                        { value: "pink", label: "Rose" },
                        { value: "sand", label: "Sable" }
                      ]}
                    />
                  </Grid>
                  <Grid>
                    <TextField label="Étiquette de la carte" value={d.label} onChange={(v) => up({ label: v })} />
                    <TextField label="Titre" value={d.title} onChange={(v) => up({ title: v })} />
                  </Grid>
                  <TextField label="Sous-titre" value={d.caption} onChange={(v) => up({ caption: v })} hint="Affiché sous le titre dans la liseuse (auteur, nombre de pages…)." />
                  {d.kind === "pdf" ? (
                    <FileField
                      label="Fichier PDF"
                      value={d.file}
                      onChange={(v) => up({ file: v })}
                      folder="candidature"
                      accept="application/pdf"
                      hint="La première page sert de miniature sur la carte."
                    />
                  ) : (
                    <>
                      <Grid>
                        <TextField label="Lieu et date" value={d.place} onChange={(v) => up({ place: v })} hint="Facultatif." />
                        <TextField label="Formule d'appel" value={d.greeting} onChange={(v) => up({ greeting: v })} />
                      </Grid>
                      <TextArea label="Lettre" rows={12} value={d.body} onChange={(v) => up({ body: v })} hint="Une ligne vide sépare deux paragraphes." />
                      <Grid>
                        <TextField label="Formule finale" value={d.closing} onChange={(v) => up({ closing: v })} />
                        <TextField label="Signature" value={d.signature} onChange={(v) => up({ signature: v })} />
                      </Grid>
                    </>
                  )}
                </>
              )}
            />
          </Card>
        </>
      );
    }
  },
  {
    id: "chiffres",
    label: "Chiffres",
    target: "#chiffres",
    hint: "Les grands nombres qui apparaissent un par un.",
    icon: "chart",
    tone: "green",
    summary: (p) => p.stats.map((s) => `${s.prefix ?? ""}${s.value}${s.suffix ?? ""}`).join(" · "),
    pick: (p) => [p.sections.stats, p.stats],
    Editor: ({ p, set }) => (
      <>
        <HeadingFields value={p.sections.stats} onChange={(v) => setSection(p, set)("stats", v)} />
        <Card title="Chiffres">
          <Repeater
            items={p.stats}
            onChange={(v) => set("stats", v)}
            defaultOpen
            itemTitle={(s) => `${s.prefix ?? ""}${s.value}${s.suffix ?? ""} · ${s.label.replace("\n", " ")}`}
            create={() => ({ value: 0, prefix: "", suffix: "", label: "" })}
            addLabel="Ajouter un chiffre"
            render={(s, up) => (
              <>
                <Grid cols={3}>
                  <TextField label="Avant" placeholder="+" value={s.prefix} onChange={(v) => up({ prefix: v })} />
                  <NumberField label="Nombre" value={s.value} onChange={(v) => up({ value: v })} />
                  <TextField label="Après" placeholder=" ans" value={s.suffix} onChange={(v) => up({ suffix: v })} />
                </Grid>
                <TextArea label="Légende" rows={2} value={s.label} onChange={(v) => up({ label: v })} hint="Un retour à la ligne crée une 2e ligne." />
              </>
            )}
          />
        </Card>
      </>
    )
  },
  {
    id: "projets",
    label: "Projets",
    target: "#projets",
    hint: "La vitrine de vos réalisations. Les projets ont leur propre espace.",
    icon: "image",
    tone: "pink",
    summary: () => "Vitrine des réalisations",
    pick: (p) => p.sections.projects,
    Editor: ({ p, set, projects }) => (
      <>
        <HeadingFields value={p.sections.projects} onChange={(v) => setSection(p, set)("projects", v)} />
        {!!projects?.length && (
          <Card title="Dans la vitrine" description="Cliquez sur un projet pour le voir dans l'aperçu.">
            <div className="adm-plist">
              {projects.map((pr, i) => {
                const cover = pr.media?.find((m) => m.type === "image")?.src ?? pr.media?.[0]?.poster;
                return (
                  <div key={pr._id} className="adm-plist__row" data-preview={`project:${pr.slug}`} data-preview-label={pr.title}>
                    <button type="button" className="adm-plist__main">
                      <span className="adm-plist__num">{String(i + 1).padStart(2, "0")}</span>
                      <span className="adm-row__thumb">{cover ? <img src={cover} alt="" /> : <Icon name="image" />}</span>
                      <span className="adm-plist__text">
                        <strong>{pr.title}</strong>
                        <small>{pr.tagline}</small>
                      </span>
                    </button>
                    <Link to={`/admin/projets/${pr._id}`} className="adm-plist__edit">
                      <Icon name="edit" /> Modifier
                    </Link>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
        <Link to="/admin/projets" className="adm-jump">
          <span className="adm-jump__icon"><Icon name="image" /></span>
          <span>
            <strong>Gérer les projets</strong>
            <small>{projects ? `${plural(projects.length, "projet")} · ` : ""}vidéos, textes, ordre d'affichage</small>
          </span>
          <Icon name="arrow" className="adm-jump__arrow" />
        </Link>
      </>
    )
  },
  {
    id: "atouts",
    label: "Ce que j'apporte",
    target: "#atouts",
    hint: "Le carrousel de cartes qui défile en bas de page.",
    icon: "badge",
    tone: "cyan",
    summary: (p) => plural(p.reasons.length, "carte"),
    pick: (p) => [p.sections.reasons, p.reasons],
    Editor: ({ p, set }) => (
      <>
        <HeadingFields value={p.sections.reasons} onChange={(v) => setSection(p, set)("reasons", v)} />
        <Card title="Cartes">
          <Repeater
            items={p.reasons}
            onChange={(v) => set("reasons", v)}
            itemTitle={(r) => r.title}
            create={() => ({ icon: "rocket", title: "Nouvel atout", text: "" })}
            addLabel="Ajouter une carte"
            render={(r, up) => (
              <>
                <Grid>
                  <TextField label="Titre" value={r.title} onChange={(v) => up({ title: v })} />
                  <Select label="Icône" value={r.icon} onChange={(v) => up({ icon: v })} options={ICONS} />
                </Grid>
                <TextArea label="Texte" rows={3} value={r.text} onChange={(v) => up({ text: v })} />
              </>
            )}
          />
        </Card>
      </>
    )
  },
  {
    id: "contact",
    label: "Contact",
    target: "#contact",
    hint: "Le dernier appel avant de partir, et vos coordonnées.",
    icon: "mail",
    tone: "green",
    summary: (p) => p.sections.cta.title,
    pick: (p) => [p.sections.cta, p.email, p.phone, p.linkedin, p.github, p.cvUrl],
    Editor: ({ p, set }) => {
      const cta = p.sections.cta;
      const setCta = (patch: Partial<typeof cta>) => setSection(p, set)("cta", { ...cta, ...patch });
      return (
        <>
          <Card title="Bas de page" preview="#contact">
            <TextField label="Titre" value={cta.title} onChange={(v) => setCta({ title: v })} />
            <Grid>
              <TextField label="Sous-titre" value={cta.subtitle} onChange={(v) => setCta({ subtitle: v })} />
              <TextField label="Bouton" value={cta.button} onChange={(v) => setCta({ button: v })} />
            </Grid>
          </Card>
          <Card title="Coordonnées" description="Affichées sur la carte de visite et dans la fenêtre de contact. Un lien vide masque son bouton." preview="modal:contact">
            <Grid>
              <TextField label="Email" type="email" value={p.email} onChange={(v) => set("email", v)} />
              <TextField label="Téléphone" value={p.phone} onChange={(v) => set("phone", v)} />
              <TextField label="LinkedIn" placeholder="https://linkedin.com/in/…" value={p.linkedin} onChange={(v) => set("linkedin", v)} />
              <TextField label="GitHub" placeholder="https://github.com/…" value={p.github} onChange={(v) => set("github", v)} />
            </Grid>
            <FileField label="CV (PDF)" value={p.cvUrl} onChange={(v) => set("cvUrl", v)} folder="cv" accept="application/pdf" />
          </Card>
        </>
      );
    }
  },
  {
    id: "apropos",
    label: "Fenêtre « À propos »",
    target: "modal:about",
    hint: "Ce qui s'ouvre avec le bouton « À propos de ce site ».",
    icon: "info",
    tone: "pink",
    fixed: true,
    summary: (p) => ({ ...ABOUT_DEFAULT, ...p.about }).title,
    pick: (p) => p.about,
    Editor: ({ p, set }) => {
      const a: AboutContent = { ...ABOUT_DEFAULT, ...p.about };
      const up = (patch: Partial<AboutContent>) => set("about", { ...a, ...patch });
      return (
        <>
          <Card title="Titre">
            <Grid>
              <TextField label="Petit titre" value={a.overline} onChange={(v) => up({ overline: v })} />
              <TextField label="Grand titre" value={a.title} onChange={(v) => up({ title: v })} />
            </Grid>
          </Card>
          <Card title="Texte">
            <LinesField label="Paragraphes" multiline value={a.paragraphs} onChange={(v) => up({ paragraphs: v })} addLabel="Ajouter un paragraphe" />
          </Card>
          <Card title="Points clés" description="Une icône et une phrase, affichés en liste.">
            <Repeater
              items={a.points}
              onChange={(points) => up({ points })}
              defaultOpen
              itemTitle={(pt) => pt.text}
              create={() => ({ icon: "check", text: "" })}
              addLabel="Ajouter un point"
              render={(pt, upP) => (
                <>
                  <Select label="Icône" value={pt.icon} onChange={(v) => upP({ icon: v })} options={ICONS} />
                  <TextArea label="Texte" rows={2} value={pt.text} onChange={(v) => upP({ text: v })} />
                </>
              )}
            />
          </Card>
          <Card title="Boutons" description="Laissez vide pour masquer un bouton.">
            <Grid>
              <TextField label="Bouton plein (Contact)" value={a.primary} onChange={(v) => up({ primary: v })} />
              <TextField label="Bouton blanc (Fermer)" value={a.secondary} onChange={(v) => up({ secondary: v })} />
            </Grid>
          </Card>
        </>
      );
    }
  },
  {
    id: "textes",
    label: "Textes du site",
    target: "nav",
    hint: "Tous les petits textes : navigation, pied de page, formulaire de contact, libellés… Un champ vidé reprend son texte d'origine.",
    icon: "edit",
    tone: "sand",
    fixed: true,
    summary: (p) => {
      const n = Object.keys(p.texts ?? {}).length;
      return n ? `${n} texte${n > 1 ? "s" : ""} personnalisé${n > 1 ? "s" : ""}` : "Textes d'origine";
    },
    pick: (p) => p.texts,
    Editor: ({ p, set }) => {
      const texts = p.texts ?? {};
      const setText = (k: TextKey, v: string) => {
        const next = { ...texts };
        if (v === textDefault(k)) delete next[k];
        else next[k] = v;
        set("texts", next);
      };
      const keys = Object.keys(TEXTS) as TextKey[];
      const long = new Set<TextKey>(["seo.description", "footer.text", "contact.sent", "contact.messagePh", "contact.error", "proj.empty"]);
      return (
        <>
          {TEXT_GROUPS.map((g) => {
            const groupKeys = keys.filter((k) => TEXTS[k][0] === g.id);
            const changed = groupKeys.filter((k) => texts[k] !== undefined);
            return (
              <Card
                key={g.id}
                preview={GROUP_TARGETS[g.id]}
                title={g.label}
                description={g.hint}
                actions={
                  changed.length > 0 ? (
                    <button
                      type="button"
                      className="adm-add"
                      onClick={() => {
                        const next = { ...texts };
                        changed.forEach((k) => delete next[k]);
                        set("texts", next);
                      }}
                    >
                      <Icon name="x" /> Rétablir
                    </button>
                  ) : undefined
                }
              >
                <Grid>
                  {groupKeys.filter((k) => !long.has(k)).map((k) => (
                    <TextField key={k} label={TEXTS[k][1]} value={texts[k] ?? textDefault(k)} onChange={(v) => setText(k, v)} placeholder={textDefault(k)} />
                  ))}
                </Grid>
                {groupKeys.filter((k) => long.has(k)).map((k) => (
                  <TextArea key={k} label={TEXTS[k][1]} rows={2} value={texts[k] ?? textDefault(k)} onChange={(v) => setText(k, v)} placeholder={textDefault(k)} />
                ))}
              </Card>
            );
          })}
        </>
      );
    }
  }
];

export const sectionDirty = (s: SectionDef, saved: Profile | null, draft: Profile | null) =>
  !!saved &&
  !!draft &&
  (JSON.stringify(s.pick(saved)) !== JSON.stringify(s.pick(draft)) ||
    !!saved.hiddenSections?.includes(s.id) !== !!draft.hiddenSections?.includes(s.id));
