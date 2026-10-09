import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Empty } from "./OtherPages";
import { statusTone } from "../ui";
import { adminApi, type Project, type ProjectMedia } from "../../api";
import { Icon } from "../../components/Icons";
import {
  Card,
  DropZone,
  Grid,
  IconButton,
  LinesField,
  Loading,
  PageHeader,
  Repeater,
  Select,
  TagsField,
  TextArea,
  TextField,
  Toggle,
  UploadButton,
  useBeforeUnload,
  useConfirm,
  useToast
} from "../ui";

const BADGE_ICONS = [
  "globe", "user", "gear", "phone", "rocket", "users", "check", "badge", "clock", "code", "database", "palette", "mail", "briefcase"
].map((v) => ({ value: v, label: v }));

const emptyProject = (): Project => ({
  slug: "",
  title: "",
  tagline: "",
  description: "",
  role: "",
  year: String(new Date().getFullYear()),
  status: "En cours",
  stack: [],
  highlights: [],
  links: [],
  media: [],
  featured: false
});

const slugify = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/* =====================================================================
   Liste : la vitrine à gauche (glisser pour ranger), l'aperçu du projet à droite
   ===================================================================== */
const coverOf = (p: Project) => p.media?.find((m) => m.type === "image")?.src ?? p.media?.[0]?.poster;


export function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const dragFrom = useRef<number | null>(null);

  useEffect(() => {
    adminApi.projects().then(setProjects).catch((e) => toast(e.message, "error"));
  }, [toast]);

  async function reorder(from: number, to: number) {
    if (!projects || from === to || to < 0 || to >= projects.length) return;
    const next = [...projects];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setProjects(next);
    try {
      setProjects(await adminApi.reorderProjects(next.map((p) => p._id!)));
      toast("Nouvel ordre publié");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function remove(p: Project) {
    if (!(await confirm({ title: `Supprimer « ${p.title} » ?`, text: "Le projet disparaît du site. Ses fichiers restent dans Fichiers.", confirmLabel: "Supprimer", danger: true }))) return;
    try {
      await adminApi.deleteProject(p._id!);
      setProjects((list) => list?.filter((x) => x._id !== p._id) ?? null);
      setSelected(null);
      toast("Projet supprimé");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function duplicate(p: Project) {
    const { _id, order, ...rest } = p;
    void _id; void order;
    try {
      const copy = await adminApi.createProject({ ...rest, title: `${p.title} (copie)`, slug: `${p.slug}-copie-${Date.now().toString(36).slice(-4)}` });
      setProjects((list) => (list ? [...list, copy] : [copy]));
      setSelected(copy._id ?? null);
      toast("Projet dupliqué");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const index = projects?.findIndex((p) => p._id === selected) ?? -1;
  const current = projects?.[index >= 0 ? index : 0];
  const at = index >= 0 ? index : 0;
  const cover = current ? coverOf(current) : undefined;

  return (
    <>
      <PageHeader
        overline="Vitrine"
        title="Projets"
        subtitle={projects ? `${projects.length} projet${projects.length > 1 ? "s" : ""} sur le site, dans cet ordre` : undefined}
        actions={
          <Link to="/admin/projets/nouveau" className="btn btn--primary btn--sm">
            <Icon name="plus" /> Nouveau projet
          </Link>
        }
      />
      {!projects ? (
        <Loading />
      ) : projects.length === 0 ? (
        <Empty icon="image" title="Aucun projet pour l'instant" text="Ajoutez votre premier projet : un titre suffit pour commencer.">
          <Link to="/admin/projets/nouveau" className="btn btn--primary btn--sm">
            <Icon name="plus" /> Nouveau projet
          </Link>
        </Empty>
      ) : (
        <div className="adm-panes adm-panes--projects">
          <section className="adm-pane">
            <header className="adm-pane__head">
              <div>
                <p className="adm-pane__title">Ordre d'affichage</p>
                <p className="adm-pane__sub">Glissez une ligne pour la déplacer</p>
              </div>
            </header>
            <ol className="adm-pane__list">
              {projects.map((p, i) => {
                const c = coverOf(p);
                return (
                  <li
                    key={p._id}
                    draggable
                    className={dragging === i ? "is-dragging" : ""}
                    onDragStart={() => {
                      dragFrom.current = i;
                      setDragging(i);
                    }}
                    onDragEnd={() => setDragging(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragFrom.current !== null) reorder(dragFrom.current, i);
                      dragFrom.current = null;
                      setDragging(null);
                    }}
                  >
                    <button
                      type="button"
                      className={`adm-row ${current?._id === p._id ? "is-active" : ""}`}
                      onClick={() => setSelected(p._id ?? null)}
                      onDoubleClick={() => navigate(`/admin/projets/${p._id}`)}
                    >
                      <span className="adm-row__grip" aria-hidden="true"><Icon name="grip" /></span>
                      <span className="adm-row__thumb">{c ? <img src={c} alt="" /> : <Icon name="image" />}</span>
                      <span className="adm-row__main">
                        <strong>
                          {p.title}
                          {p.featured && <Icon name="star" className="adm-row__star" aria-label="Mis en avant" />}
                        </strong>
                        <small>{p.tagline}</small>
                      </span>
                      <span className="adm-row__num">{String(i + 1).padStart(2, "0")}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <Link to="/admin/projets/nouveau" className="adm-pane__add">
              <Icon name="plus" /> Ajouter un projet
            </Link>
          </section>

          {current && (
            <article className="adm-pane adm-pview" key={current._id}>
              <div className="adm-pview__shot">
                <span className="adm-pcard__chrome" aria-hidden="true"><i /><i /><i /></span>
                {cover ? <img src={cover} alt="" /> : <Icon name="image" />}
              </div>
              <div className="adm-pview__body">
                <p className="adm-pview__meta">
                  <span className={`adm-status ${statusTone(current.status)}`}>{current.status}</span>
                  {current.year}
                  {current.role ? ` · ${current.role}` : ""}
                </p>
                <h2 className="adm-pview__title">{current.title}</h2>
                <p className="adm-pview__tag">{current.tagline}</p>
                <dl className="adm-pview__facts">
                  <div className="adm-tone--cyan">
                    <dt>Médias</dt>
                    <dd>{current.media?.length ?? 0}</dd>
                  </div>
                  <div className="adm-tone--green">
                    <dt>Points forts</dt>
                    <dd>{current.highlights.length}</dd>
                  </div>
                  <div className="adm-tone--pink">
                    <dt>Technologies</dt>
                    <dd>{current.stack.length}</dd>
                  </div>
                </dl>
                {current.stack.length > 0 && (
                  <div className="adm-pview__stack">
                    {current.stack.map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <footer className="adm-pview__actions">
                <Link to={`/admin/projets/${current._id}`} className="btn btn--primary btn--sm">
                  <Icon name="edit" /> Modifier
                </Link>
                <IconButton icon="chevron" className="is-up" label="Monter dans la vitrine" onClick={() => reorder(at, at - 1)} disabled={at === 0} />
                <IconButton icon="chevron" label="Descendre dans la vitrine" onClick={() => reorder(at, at + 1)} disabled={at === projects.length - 1} />
                <IconButton icon="copy" label="Dupliquer" onClick={() => duplicate(current)} />
                <IconButton icon="trash" label="Supprimer" tone="danger" onClick={() => remove(current)} />
              </footer>
            </article>
          )}
        </div>
      )}
    </>
  );
}

/* =====================================================================
   Médias d'un projet : une grille de vignettes
   ===================================================================== */
function MediaManager({ slug, media, onChange }: { slug: string; media: ProjectMedia[]; onChange: (m: ProjectMedia[]) => void }) {
  const folder = `projets-${slug || "nouveau"}`;
  const dragFrom = useRef<number | null>(null);
  const latest = useRef(media);
  latest.current = media;
  const patch = (i: number, p: Partial<ProjectMedia>) => onChange(media.map((m, j) => (j === i ? { ...m, ...p } : m)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= media.length || from === to) return;
    const next = [...media];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };

  return (
    <div className="adm-mgrid">
      {media.map((m, i) => (
        <figure
          key={m.src + i}
          className="adm-mtile"
          draggable
          onDragStart={() => (dragFrom.current = i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragFrom.current !== null) move(dragFrom.current, i);
            dragFrom.current = null;
          }}
        >
          <div className="adm-mtile__shot">
            {m.src ? m.type === "video" ? <video src={m.src} poster={m.poster} muted preload="metadata" /> : <img src={m.src} alt="" /> : <Icon name="image" />}
            <span className="adm-mtile__kind">{i === 0 ? "Couverture" : m.type === "video" ? "Vidéo" : "Image"}</span>
            <div className="adm-mtile__tools">
              <IconButton icon="left" label="Avancer" onClick={() => move(i, i - 1)} disabled={i === 0} />
              <IconButton icon="right" label="Reculer" onClick={() => move(i, i + 1)} disabled={i === media.length - 1} />
              <IconButton icon="trash" label="Retirer" tone="danger" onClick={() => onChange(media.filter((_, j) => j !== i))} />
            </div>
          </div>
          <input className="adm-mtile__caption" value={m.caption} placeholder="Légende (nom de l'onglet)" onChange={(e) => patch(i, { caption: e.target.value })} aria-label="Légende" />
          {m.type === "video" && (
            <UploadButton folder={folder} accept="image/*" label={m.poster ? "Changer l'image d'attente" : "Ajouter une image d'attente"} onUploaded={(f) => patch(i, { poster: f.url })} />
          )}
        </figure>
      ))}
      <DropZone
        folder={folder}
        accept="image/*,video/mp4,video/webm,video/quicktime"
        title="Ajouter des photos ou vidéos"
        text="Glissez-les ici, ou cliquez"
        onUploaded={(f) =>
          onChange([
            ...latest.current,
            { type: f.type.startsWith("video") ? "video" : "image", src: f.url, caption: f.name.replace(/\.[^.]+$/, "") }
          ])
        }
      />
    </div>
  );
}

/* =====================================================================
   Édition / création
   ===================================================================== */
export function ProjectEditPage() {
  const { id } = useParams();
  const isNew = id === "nouveau";
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [saved, setSaved] = useState<Project | null>(isNew ? emptyProject() : null);
  const [draft, setDraft] = useState<Project | null>(isNew ? emptyProject() : null);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  useEffect(() => {
    if (isNew) return;
    adminApi
      .projects()
      .then((list) => {
        const p = list.find((x) => x._id === id);
        if (!p) throw new Error("Projet introuvable");
        setSaved(p);
        setDraft(p);
      })
      .catch((e) => toast(e.message, "error"));
  }, [id, isNew, toast]);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  useBeforeUnload(dirty);

  if (!draft) return <Loading />;
  const up = (patch: Partial<Project>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = isNew ? await adminApi.createProject(draft) : await adminApi.updateProject(id!, draft);
      setSaved(res);
      setDraft(res);
      toast(isNew ? "Projet créé" : "Projet publié");
      if (isNew) navigate(`/admin/projets/${res._id}`, { replace: true });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!(await confirm({ title: `Supprimer « ${draft!.title} » ?`, confirmLabel: "Supprimer", danger: true }))) return;
    await adminApi.deleteProject(id!);
    toast("Projet supprimé");
    navigate("/admin/projets");
  }

  const cover = coverOf(draft);
  return (
    <>
      <Link to="/admin/projets" className="adm-back">
        <Icon name="left" /> Tous les projets
      </Link>
      <div className="adm-pedit">
        <div className="adm-pedit__main">
          <PageHeader overline={isNew ? "Nouveau projet" : "Projet"} title={draft.title || "Sans titre"} subtitle={isNew ? "Commencez par le titre, le reste peut attendre." : undefined} />

          <Card title="L'essentiel">
            <TextField label="Titre" value={draft.title} onChange={(v) => up({ title: v, ...(slugTouched ? {} : { slug: slugify(v) }) })} />
            <TextField label="En une phrase" value={draft.tagline} onChange={(v) => up({ tagline: v })} placeholder="Ce que fait le projet, pour qui" />
            <TextArea label="Description" rows={4} value={draft.description} onChange={(v) => up({ description: v })} />
            <Grid cols={3}>
              <TextField label="Statut" placeholder="En ligne" value={draft.status} onChange={(v) => up({ status: v })} />
              <TextField label="Année" value={draft.year} onChange={(v) => up({ year: v })} />
              <TextField label="Votre rôle" value={draft.role} onChange={(v) => up({ role: v })} />
            </Grid>
          </Card>

          <Card title="Photos & vidéos" description="Glissez les vignettes pour les ranger. La première sert de couverture.">
            <MediaManager slug={draft.slug} media={draft.media ?? []} onChange={(media) => up({ media })} />
          </Card>

          <Card title="Points forts" description="Format conseillé : « Titre court — explication ».">
            <LinesField label="Points forts" value={draft.highlights} onChange={(v) => up({ highlights: v })} addLabel="Ajouter un point fort" />
          </Card>

          <Card title="Technologies & liens">
            <TagsField label="Stack technique" value={draft.stack} onChange={(v) => up({ stack: v })} />
            <Repeater
              items={draft.links}
              onChange={(links) => up({ links })}
              defaultOpen
              itemTitle={(l) => l.label || l.url}
              create={() => ({ label: "Voir le site", url: "https://" })}
              addLabel="Ajouter un lien"
              render={(l, upL) => (
                <Grid>
                  <TextField label="Texte du bouton" value={l.label} onChange={(v) => upL({ label: v })} />
                  <TextField label="Adresse" value={l.url} onChange={(v) => upL({ url: v })} />
                </Grid>
              )}
            />
          </Card>

          <details className="adm-more">
            <summary>
              <Icon name="gear" /> Réglages avancés
              <Icon name="chevron" className="adm-more__chev" />
            </summary>
            <div className="adm-more__body">
              <TextField
                label="Adresse du projet (slug)"
                value={draft.slug}
                onChange={(v) => {
                  setSlugTouched(true);
                  up({ slug: slugify(v) });
                }}
                hint="Lettres minuscules, chiffres et tirets. Sert aussi de dossier pour les fichiers."
              />
              <p className="adm-label">Badges (3 infos clés, facultatif)</p>
              <Repeater
                items={draft.badges ?? []}
                onChange={(badges) => up({ badges: badges.slice(0, 3) })}
                itemTitle={(b) => [b.value, b.label].filter(Boolean).join(" · ")}
                create={() => ({ icon: "check", value: "", label: "" })}
                addLabel="Ajouter un badge"
                render={(b, upB) => (
                  <Grid cols={3}>
                    <Select label="Icône" value={b.icon} onChange={(v) => upB({ icon: v })} options={BADGE_ICONS} />
                    <TextField label="Info clé" value={b.value} onChange={(v) => upB({ value: v })} placeholder="En ligne" />
                    <TextField label="Détail" value={b.label} onChange={(v) => upB({ label: v })} placeholder="anasawi.com" />
                  </Grid>
                )}
              />
            </div>
          </details>
        </div>

        {/* ---- carte récapitulative, toujours visible ---- */}
        <aside className="adm-pedit__side">
          <div className="adm-pside">
            <div className="adm-pside__shot">
              <span className="adm-pcard__chrome" aria-hidden="true"><i /><i /><i /></span>
              {cover ? <img src={cover} alt="" /> : <Icon name="image" />}
            </div>
            <div className="adm-pside__body">
              <span className={`adm-status ${statusTone(draft.status)}`}>{draft.status || "Statut"}</span>
              <p className="adm-pside__title">{draft.title || "Sans titre"}</p>
              <p className="adm-pside__tag">{draft.tagline || "Votre phrase d'accroche apparaîtra ici."}</p>
              <Toggle label="Mettre en avant" checked={draft.featured} onChange={(v) => up({ featured: v })} />
            </div>
            <div className="adm-pside__actions">
              <p className={`adm-pside__state ${dirty || isNew ? "is-dirty" : ""}`}>
                <span className="adm-publish__dot" />
                {isNew ? "Pas encore créé" : dirty ? "Modifications non publiées" : "À jour sur le site"}
              </p>
              <button type="button" className="btn btn--primary btn--block" onClick={save} disabled={saving || (!dirty && !isNew) || !draft.title.trim()}>
                <Icon name="send" /> {saving ? "Publication…" : isNew ? "Créer le projet" : "Publier"}
              </button>
              {!isNew && (
                <button type="button" className="adm-pside__delete" onClick={remove}>
                  <Icon name="trash" /> Supprimer le projet
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
