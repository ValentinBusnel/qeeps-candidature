import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { adminApi, type InboxMessage, type Overview, type Project, type UploadedFile } from "../../api";
import { Icon } from "../../components/Icons";
import { useTheme } from "../../theme/ThemeProvider";
import { colors as defaultColors } from "../../theme/tokens";
import { useAuth } from "../AuthContext";
import { useProfileDraft } from "../ProfileDraft";
import { SECTIONS, sectionDirty } from "../sections";
import { SiteLink } from "../AdminLayout";
import { statusTone, Card, DropZone, formatSize, Loading, PageHeader, TextField, UploadButton, useConfirm, useToast } from "../ui";

/* =====================================================================
   Accueil : même grammaire que les messages (bloc gris, volets blancs, rangées)
   ===================================================================== */
const coverOf = (p: Project) => p.media?.find((m) => m.type === "image")?.src ?? p.media?.[0]?.poster;
const initialsOf = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const shortDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export function DashboardPage() {
  const [o, setO] = useState<Overview | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  const { draft, saved } = useProfileDraft();
  useEffect(() => {
    adminApi.overview().then(setO).catch(() => {});
    adminApi.projects().then(setProjects).catch(() => setProjects([]));
    adminApi.messages().then(setMessages).catch(() => setMessages([]));
  }, []);

  const hour = new Date().getHours();
  const hello = hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour";
  const pending = SECTIONS.filter((s) => sectionDirty(s, saved, draft)).length;

  return (
    <>
      <header className="adm-hello">
        <span className="adm-hello__glow" aria-hidden="true" />
        <div className="adm-hello__text">
          <p className="adm-overline">Tableau de bord</p>
          <h1 className="adm-hello__title">
            <span className="t-gradient">
              {hello}
              {draft?.firstName ? ` ${draft.firstName}` : ""}
            </span>{" "}
            <span className="adm-hello__wave" aria-hidden="true">👋</span>
          </h1>
          <div className="adm-hello__chips">
            {pending ? (
              <span className="adm-pill adm-tone--sand">
                <span className="adm-pill__dot" /> {pending} section{pending > 1 ? "s" : ""} à publier
              </span>
            ) : (
              <span className="adm-pill adm-tone--green">
                <span className="adm-pill__dot" /> Site en ligne
              </span>
            )}
            <span className="adm-pill adm-tone--cyan">
              <Icon name="mail" /> {o ? o.unread : "–"} non lu{(o?.unread ?? 0) > 1 ? "s" : ""}
            </span>
            <span className="adm-pill adm-tone--pink">
              <Icon name="image" /> {projects ? projects.length : "–"} projet{(projects?.length ?? 0) > 1 ? "s" : ""}
            </span>
            {o?.updatedAt && (
              <span className="adm-pill adm-pill--plain">
                Publié le {new Date(o.updatedAt).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>
        <div className="adm-page-actions">
          <SiteLink className="btn btn--secondary btn--sm">
            <Icon name="eye" /> Voir le site
          </SiteLink>
          <Link to="/admin/contenu" className="btn btn--primary btn--sm">
            <Icon name="edit" /> Modifier mon site
          </Link>
        </div>
      </header>

      <div className="adm-panes adm-panes--home">
        <section className="adm-pane">
          <header className="adm-pane__head">
            <div>
              <p className="adm-pane__title">Votre page</p>
              <p className="adm-pane__sub">Les sections du site, dans l'ordre de lecture</p>
            </div>
          </header>
          <ol className="adm-pane__list">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <Link to={`/admin/contenu/${s.id}`} className={`adm-row adm-tone--${s.tone}`}>
                  <span className="adm-chip-icon"><Icon name={s.icon} /></span>
                  <span className="adm-row__main">
                    <strong>
                      {s.label}
                      {sectionDirty(s, saved, draft) && <span className="adm-plan__dot" title="Modifié, pas encore publié" />}
                    </strong>
                    <small>{draft ? s.summary(draft) : "…"}</small>
                  </span>
                  <Icon name="right" className="adm-row__chev" />
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <div className="adm-panes__stack">
          <section className="adm-pane">
            <header className="adm-pane__head">
              <div>
                <p className="adm-pane__title">
                  Messages {!!o?.unread && <span className="adm-badge">{o.unread}</span>}
                </p>
                <p className="adm-pane__sub">Reçus via « Me contacter »</p>
              </div>
              <Link to="/admin/messages" className="adm-pane__link">Tout voir</Link>
            </header>
            {!messages ? (
              <Loading />
            ) : messages.length === 0 ? (
              <p className="adm-pane__empty">Aucun message pour l'instant.</p>
            ) : (
              <ul className="adm-pane__list">
                {messages.slice(0, 3).map((m) => (
                  <li key={m._id}>
                    <Link to="/admin/messages" className={`adm-row ${m.read ? "" : "is-unread"}`}>
                      <span className="adm-msg__avatar">{initialsOf(m.name)}</span>
                      <span className="adm-row__main">
                        <strong>{m.name}</strong>
                        <small>{m.message}</small>
                      </span>
                      <time className="adm-row__meta">{shortDate(m.createdAt)}</time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="adm-pane">
            <header className="adm-pane__head">
              <div>
                <p className="adm-pane__title">Projets</p>
                <p className="adm-pane__sub">Dans l'ordre de la vitrine</p>
              </div>
              <Link to="/admin/projets" className="adm-pane__link">Gérer</Link>
            </header>
            {!projects ? (
              <Loading />
            ) : (
              <ul className="adm-pane__list">
                {projects.map((p) => {
                  const cover = coverOf(p);
                  return (
                    <li key={p._id}>
                      <Link to={`/admin/projets/${p._id}`} className="adm-row">
                        <span className="adm-row__thumb">{cover ? <img src={cover} alt="" /> : <Icon name="image" />}</span>
                        <span className="adm-row__main">
                          <strong>{p.title}</strong>
                          <small>{p.tagline}</small>
                        </span>
                        <span className={`adm-status ${statusTone(p.status)}`}>{p.status}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

/* =====================================================================
   Messages : boîte de réception en deux volets
   ===================================================================== */
const initials = initialsOf;

export function MessagesPage() {
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const { readOnly } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    adminApi.messages().then(setMessages).catch((e) => toast(e.message, "error"));
  }, [toast]);

  async function toggle(m: InboxMessage, read = !m.read) {
    const updated = await adminApi.markMessage(m._id, read);
    setMessages((list) => list?.map((x) => (x._id === m._id ? updated : x)) ?? null);
  }

  async function open(m: InboxMessage) {
    setOpenId(m._id);
    if (!m.read && !readOnly) await toggle(m, true);
  }

  async function remove(m: InboxMessage) {
    if (!(await confirm({ title: "Supprimer ce message ?", text: `De ${m.name}`, confirmLabel: "Supprimer", danger: true }))) return;
    await adminApi.deleteMessage(m._id);
    setMessages((list) => list?.filter((x) => x._id !== m._id) ?? null);
    setOpenId(null);
    toast("Message supprimé");
  }

  const current = messages?.find((m) => m._id === openId);
  const unread = messages?.filter((m) => !m.read).length ?? 0;

  return (
    <>
      <PageHeader
        overline="Formulaire « Me contacter »"
        title="Messages"
        subtitle={messages ? (unread ? `${unread} non lu${unread > 1 ? "s" : ""} sur ${messages.length}` : "Tout est lu.") : undefined}
      />
      {!messages ? (
        <Loading />
      ) : messages.length === 0 ? (
        <Empty icon="mail" title="Aucun message pour l'instant" text="Les messages envoyés depuis le site arriveront ici." />
      ) : (
        <div className={`adm-inbox ${current ? "has-open" : ""}`}>
          <ul className="adm-inbox__list">
            {messages.map((m) => (
              <li key={m._id}>
                <button type="button" className={`adm-msg ${m.read ? "" : "is-unread"} ${openId === m._id ? "is-active" : ""}`} onClick={() => open(m)}>
                  <span className="adm-msg__avatar">{initials(m.name)}</span>
                  <span className="adm-msg__main">
                    <span className="adm-msg__top">
                      <strong>{m.name}</strong>
                      <time>{new Date(m.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</time>
                    </span>
                    <span className="adm-msg__preview">{m.message}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <article className="adm-reader">
            {current ? (
              <div key={current._id} className="adm-reader__in">
                <button type="button" className="adm-reader__back" onClick={() => setOpenId(null)}>
                  <Icon name="left" /> Tous les messages
                </button>
                <header className="adm-reader__head">
                  <span className="adm-msg__avatar adm-msg__avatar--lg">{initials(current.name)}</span>
                  <div>
                    <p className="adm-reader__name">{current.name}</p>
                    <p className="adm-reader__meta">
                      {current.email}
                    </p>
                  </div>
                  <time>{new Date(current.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</time>
                </header>
                <p className="adm-reader__body">{current.message}</p>
                <div className="adm-reader__actions">
                  <a className="btn btn--primary btn--sm" href={`mailto:${current.email}?subject=${encodeURIComponent("Re : votre message")}`}>
                    <Icon name="send" /> Répondre
                  </a>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => toggle(current)}>
                    Marquer comme {current.read ? "non lu" : "lu"}
                  </button>
                  <button type="button" className="adm-icon-btn is-danger" onClick={() => remove(current)} aria-label="Supprimer" title="Supprimer">
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="adm-reader__empty">
                <Icon name="mail" />
                <p>Choisissez un message à lire</p>
              </div>
            )}
          </article>
        </div>
      )}
    </>
  );
}

export function Empty({ icon, title, text, children }: { icon: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="adm-empty">
      <span className="adm-empty__icon"><Icon name={icon} /></span>
      <p className="adm-empty__title">{title}</p>
      {text && <p className="adm-empty__text">{text}</p>}
      {children}
    </div>
  );
}

/* =====================================================================
   Fichiers : dossiers à gauche, contenu à droite (comme les messages)
   ===================================================================== */
const isImage = (n: string) => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(n);
const isVideo = (n: string) => /\.(mp4|webm|mov)$/i.test(n);

/** « projets-anasawi » → « Anasawi », « cv » → « CV »… */
function folderLabel(f: string) {
  if (f === "tous") return "Tous les fichiers";
  if (f.startsWith("projets-")) return f.slice(8).split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return ({ avatar: "Photo de profil", cv: "CV", logos: "Logos", divers: "Divers" } as Record<string, string>)[f] ?? f;
}

export function MediaPage() {
  const [files, setFiles] = useState<UploadedFile[] | null>(null);
  const [folder, setFolder] = useState("tous");
  const [selected, setSelected] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const load = () => adminApi.uploads().then(setFiles).catch((e) => toast(e.message, "error"));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    files?.forEach((f) => counts.set(f.folder, (counts.get(f.folder) ?? 0) + 1));
    const list = [...counts.entries()].sort(([a], [b]) => Number(b.startsWith("projets-")) - Number(a.startsWith("projets-")) || a.localeCompare(b));
    return [["tous", files?.length ?? 0] as [string, number], ...list];
  }, [files]);
  const shown = files?.filter((f) => folder === "tous" || f.folder === folder) ?? [];
  const current = shown.find((f) => f.url === selected);
  const projectFolders = folders.filter(([f]) => f.startsWith("projets-"));
  const otherFolders = folders.filter(([f]) => f !== "tous" && !f.startsWith("projets-"));

  async function remove(f: UploadedFile) {
    if (!(await confirm({ title: `Supprimer ${f.name} ?`, text: "Les pages qui l'utilisent afficheront un emplacement vide.", confirmLabel: "Supprimer", danger: true }))) return;
    await adminApi.deleteUpload(f.url);
    setFiles((list) => list?.filter((x) => x.url !== f.url) ?? null);
    setSelected(null);
    toast("Fichier supprimé");
  }

  const FolderRow = ([f, n]: [string, number]) => (
    <li key={f}>
      <button type="button" className={`adm-row ${folder === f ? "is-active" : ""}`} onClick={() => { setFolder(f); setSelected(null); }}>
        <span className={`adm-chip-icon adm-tone--${f === "tous" ? "cyan" : f.startsWith("projets-") ? "pink" : f === "cv" ? "green" : "sand"}`}><Icon name={f === "tous" ? "layers" : f.startsWith("projets-") ? "image" : f === "avatar" ? "user" : "folder"} /></span>
        <span className="adm-row__main"><strong>{folderLabel(f)}</strong></span>
        <span className="adm-row__meta">{n}</span>
      </button>
    </li>
  );

  return (
    <>
      <PageHeader
        overline="Images, vidéos, PDF"
        title="Fichiers"
        subtitle={files ? `${files.length} fichier${files.length > 1 ? "s" : ""} sur le site` : undefined}
        actions={<UploadButton folder={folder === "tous" ? "divers" : folder} multiple onUploaded={() => load()} label="Envoyer des fichiers" />}
      />
      {!files ? (
        <Loading />
      ) : (
        <div className="adm-panes adm-panes--files">
          <nav className="adm-pane" aria-label="Dossiers">
            <ul className="adm-pane__list adm-pane__list--top">{FolderRow(folders[0])}</ul>
            {projectFolders.length > 0 && (
              <>
                <p className="adm-pane__group">Projets</p>
                <ul className="adm-pane__list">{projectFolders.map(FolderRow)}</ul>
              </>
            )}
            {otherFolders.length > 0 && (
              <>
                <p className="adm-pane__group">Site</p>
                <ul className="adm-pane__list">{otherFolders.map(FolderRow)}</ul>
              </>
            )}
          </nav>

          <section className="adm-pane">
            <header className="adm-pane__head">
              <div>
                <p className="adm-pane__title">{folderLabel(folder)}</p>
                <p className="adm-pane__sub">
                  {shown.length} fichier{shown.length > 1 ? "s" : ""}
                  {folder !== "tous" ? ` · dossier « ${folder} »` : ""}
                </p>
              </div>
            </header>
            {shown.length === 0 ? (
              <p className="adm-pane__empty">Ce dossier est vide.</p>
            ) : (
              <div className="adm-files">
                {shown.map((f) => (
                  <button key={f.url} type="button" className={`adm-file ${selected === f.url ? "is-active" : ""}`} onClick={() => setSelected(selected === f.url ? null : f.url)}>
                    <span className="adm-file__shot">
                      {isImage(f.name) ? <img src={f.url} alt="" loading="lazy" /> : isVideo(f.name) ? <video src={f.url} muted preload="metadata" /> : <Icon name="folder" />}
                      {isVideo(f.name) && <span className="adm-file__kind"><Icon name="play" /></span>}
                    </span>
                    <span className="adm-file__name" title={f.name}>{f.name}</span>
                    <span className="adm-file__size">{formatSize(f.size)}</span>
                  </button>
                ))}
              </div>
            )}
            <DropZone folder={folder === "tous" ? "divers" : folder} onUploaded={() => load()} title="Ajouter des fichiers ici" text={`Glissez-les dans ce cadre · rangés dans « ${folder === "tous" ? "divers" : folder} »`} compact />

            {current && (
              <footer className="adm-file-detail" key={current.url}>
                <span className="adm-file-detail__shot">
                  {isImage(current.name) ? <img src={current.url} alt="" /> : isVideo(current.name) ? <video src={current.url} muted preload="metadata" /> : <Icon name="folder" />}
                </span>
                <div className="adm-file-detail__info">
                  <strong title={current.name}>{current.name}</strong>
                  <small>{folderLabel(current.folder)} · {formatSize(current.size)}</small>
                </div>
                <div className="adm-file-detail__actions">
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(current.url);
                      toast("Lien copié");
                    }}
                  >
                    <Icon name="copy" /> Copier le lien
                  </button>
                  <a className="adm-icon-btn" href={current.url} target="_blank" rel="noreferrer" title="Ouvrir dans un onglet" aria-label="Ouvrir dans un onglet">
                    <Icon name="external" />
                  </a>
                  <button type="button" className="adm-icon-btn is-danger" onClick={() => remove(current)} aria-label="Supprimer" title="Supprimer">
                    <Icon name="trash" />
                  </button>
                </div>
              </footer>
            )}
          </section>
        </div>
      )}
    </>
  );
}

/* =====================================================================
   Apparence
   ===================================================================== */
export function AppearancePage() {
  const { overrides, preview } = useTheme();
  const [saved, setSaved] = useState<Record<string, string>>(overrides);
  const [draft, setDraft] = useState<Record<string, string>>(overrides);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    adminApi.settings().then((s) => {
      setSaved(s.colors ?? {});
      setDraft(s.colors ?? {});
    });
  }, []);

  // aperçu en direct sur toute l'interface ; on revient à l'enregistré en quittant la page
  useEffect(() => {
    preview(draft);
  }, [draft, preview]);
  const savedRef = useRef(saved);
  savedRef.current = saved;
  useEffect(() => () => preview(savedRef.current), [preview]);

  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  async function save() {
    setSaving(true);
    try {
      const s = await adminApi.saveSettings({ colors: draft });
      setSaved(s.colors);
      toast("Couleurs enregistrées");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        overline="Réglages"
        title="Couleurs du site"
        subtitle="Cliquez sur une pastille pour changer une couleur. Le résultat s'applique tout de suite, y compris ici."
        actions={
          <>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setDraft({})} disabled={!Object.keys(draft).length}>
              Couleurs d'origine
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={save} disabled={!dirty || saving}>
              <Icon name="check" /> {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </>
        }
      />
      {defaultColors.map((g) => (
        <Card key={g.group} title={g.group}>
          <div className="adm-colors">
            {g.tokens.map((t) => {
              const value = draft[t.cssVar] ?? t.value;
              const changed = draft[t.cssVar] !== undefined;
              return (
                <div key={t.cssVar} className="adm-color">
                  <label className="adm-color__swatch" style={{ background: value }}>
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => setDraft((d) => ({ ...d, [t.cssVar]: e.target.value.toUpperCase() }))}
                      aria-label={t.name}
                    />
                  </label>
                  <div className="adm-color__info">
                    <strong>{t.name}</strong>
                    <small>{t.usage}</small>
                    <input
                      className="input adm-color__hex"
                      value={value}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        if (/^#[0-9a-fA-F]{6}$/.test(v)) setDraft((d) => ({ ...d, [t.cssVar]: v.toUpperCase() }));
                      }}
                    />
                  </div>
                  {changed && (
                    <button
                      type="button"
                      className="adm-icon-btn"
                      title="Revenir à la couleur d'origine"
                      onClick={() =>
                        setDraft((d) => {
                          const n = { ...d };
                          delete n[t.cssVar];
                          return n;
                        })
                      }
                    >
                      <Icon name="x" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </>
  );
}

/* =====================================================================
   Compte
   ===================================================================== */
export function AccountPage() {
  const { email, setUser, readOnly } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { reload } = useProfileDraft();
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState(email ?? "");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");
    if (newPassword && newPassword !== confirmPassword) return toast("Les deux mots de passe ne correspondent pas", "error");
    setBusy(true);
    try {
      const res = await adminApi.account({
        currentPassword: String(data.get("currentPassword")),
        email: newEmail !== email ? newEmail : undefined,
        newPassword: newPassword || undefined
      });
      setUser(res);
      (e.target as HTMLFormElement).reset();
      toast(newPassword ? "Mot de passe changé, les autres sessions sont déconnectées" : "Compte mis à jour");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    const ok = await confirm({
      title: "Remettre tout le contenu à zéro ?",
      text: "Profil, textes, projets et couleurs reviennent à la version d'origine (seed-data.ts). Les messages, fichiers et votre compte sont conservés. Action irréversible.",
      confirmLabel: "Tout réinitialiser",
      danger: true
    });
    if (!ok) return;
    await adminApi.resetContent();
    reload();
    toast("Contenu réinitialisé");
  }

  return (
    <>
      <PageHeader overline="Réglages" title="Identifiants" subtitle="L'email et le mot de passe qui ouvrent cet espace." />
      <Card title="Email et mot de passe" description="Votre mot de passe actuel est demandé pour toute modification.">
        <form className="adm-form" onSubmit={onSubmit} data-ro-allow>
          <TextField label="Email de connexion" type="email" value={newEmail} onChange={setNewEmail} autoComplete="username" />
          <div className="field">
            <label htmlFor="np">Nouveau mot de passe (optionnel)</label>
            <input id="np" name="newPassword" type="password" className="input" minLength={10} autoComplete="new-password" />
            <p className="adm-hint">10 caractères minimum.</p>
          </div>
          <div className="field">
            <label htmlFor="cp2">Confirmer le nouveau mot de passe</label>
            <input id="cp2" name="confirmPassword" type="password" className="input" autoComplete="new-password" />
          </div>
          <div className="field">
            <label htmlFor="cp">Mot de passe actuel</label>
            <input id="cp" name="currentPassword" type="password" className="input" required autoComplete="current-password" />
          </div>
          <button className="btn btn--primary" disabled={busy}>
            <Icon name="check" /> {busy ? "Enregistrement…" : "Mettre à jour"}
          </button>
        </form>
      </Card>
      {!readOnly && <Card title="Zone de danger">
        <div className="adm-danger">
          <p className="t-body">Revenir au contenu d'origine du fichier seed-data.ts.</p>
          <button type="button" className="btn btn--danger btn--sm" onClick={reset}>
            Réinitialiser le contenu
          </button>
        </div>
      </Card>}
    </>
  );
}
