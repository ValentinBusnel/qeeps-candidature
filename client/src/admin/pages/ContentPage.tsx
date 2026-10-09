import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { adminApi, type Profile, type Project } from "../../api";
import { Icon } from "../../components/Icons";
import LivePreview from "../LivePreview";
import { useProfileDraft } from "../ProfileDraft";
import { SECTIONS, sectionDirty } from "../sections";
import { Loading, Toggle } from "../ui";

/**
 * « Mon site » : à gauche le plan de la page, au centre les champs de la section choisie,
 * à droite le site qui se met à jour en direct. On modifie ce qu'on voit, dans l'ordre où on le lit.
 */
export function ContentPage() {
  const { section } = useParams();
  const navigate = useNavigate();
  const { draft, saved, update, error } = useProfileDraft();
  const [projects, setProjects] = useState<Project[]>();
  const [previewOpen, setPreviewOpen] = useState(false);
  // endroit du site sur lequel on travaille (bloc ou élément sous le curseur / le focus)
  const [focus, setFocus] = useState<{ target: string; label: string } | null>(null);
  const pickRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    adminApi.projects().then(setProjects).catch(() => {});
  }, []);

  const index = SECTIONS.findIndex((s) => s.id === section);
  // remonte en haut du formulaire à chaque changement de section
  const formRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const picked = pickRef.current;
    pickRef.current = undefined;
    formRef.current?.scrollTo({ top: 0 });
    document.querySelector(".adm-main")?.scrollTo({ top: 0 });
    if (!picked) return setFocus(null);
    // arrivé depuis « Modifier » dans l'aperçu : on amène le bon bloc sous les yeux
    const tm = setTimeout(() => {
      const el = formRef.current?.querySelector<HTMLElement>(`[data-preview="${CSS.escape(picked)}"]`);
      if (!el) return;
      setFocus({ target: picked, label: el.dataset.previewLabel ?? "" });
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.remove("is-flash");
      void el.offsetWidth;
      el.classList.add("is-flash");
    }, 80);
    return () => clearTimeout(tm);
  }, [section]);

  // le bloc montré dans l'aperçu est signalé dans le formulaire
  useEffect(() => {
    formRef.current?.querySelectorAll<HTMLElement>("[data-preview]").forEach((el) => {
      el.classList.toggle("is-previewed", !!focus && el.dataset.preview === focus.target);
    });
  }, [focus, section, draft]);

  if (!section) return <Navigate to={`/admin/contenu/${SECTIONS[0].id}`} replace />;
  if (index < 0) return <Navigate to="/admin/contenu" replace />;
  if (error) return <p className="adm-error">{error}</p>;

  const s = SECTIONS[index];
  const prev = SECTIONS[index - 1];
  const next = SECTIONS[index + 1];
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => update((p) => ({ ...p, [key]: value }));
  const Editor = s.Editor;
  const hidden = !!draft?.hiddenSections?.includes(s.id);
  const target = focus?.target ?? s.target;
  const targetLabel = focus?.label || s.label;

  // on travaille dans un bloc : l'aperçu y va
  const onWork = (e: { target: EventTarget }) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-preview]");
    const t = el?.dataset.preview;
    if (!t) return setFocus(null);
    if (t !== focus?.target) setFocus({ target: t, label: el!.dataset.previewLabel ?? "" });
  };
  // « Modifier » cliqué dans l'aperçu : on ouvre la bonne section (et le bon bloc)
  const onPick = (id: string, t?: string) => {
    if (!SECTIONS.some((x) => x.id === id)) return;
    if (id === s.id) {
      const el = t ? formRef.current?.querySelector<HTMLElement>(`[data-preview="${CSS.escape(t)}"]`) : null;
      if (el) {
        setFocus({ target: t!, label: el.dataset.previewLabel ?? "" });
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.remove("is-flash");
        void el.offsetWidth;
        el.classList.add("is-flash");
      }
      return;
    }
    pickRef.current = t;
    navigate(`/admin/contenu/${id}`);
  };

  return (
    <div className={`adm-editor ${previewOpen ? "is-preview-open" : ""}`}>
      {/* ---- plan du site ---- */}
      <nav className="adm-plan" aria-label="Sections du site">
        <p className="adm-plan__title">Votre page</p>
        <ol>
          {SECTIONS.map((x, i) => (
            <li key={x.id}>
              <Link to={`/admin/contenu/${x.id}`} className={`adm-plan__link adm-tone--${x.tone} ${x.id === s.id ? "is-active" : ""}`} aria-current={x.id === s.id ? "page" : undefined}>
                <span className="adm-plan__num">
                  <Icon name={x.icon} />
                  <i>{String(i + 1).padStart(2, "0")}</i>
                </span>
                <span className="adm-plan__label">{x.label}</span>
                {sectionDirty(x, saved, draft) && <span className="adm-plan__dot" title="Modifié, pas encore publié" />}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      {/* ---- champs ---- */}
      <section className={`adm-form-col adm-tone--${s.tone}`} ref={formRef} onFocusCapture={onWork} onPointerDownCapture={onWork}>
        <header className={`adm-sec-head adm-tone--${s.tone}`} key={`head-${s.id}`}>
          <span className="adm-chip-icon adm-sec-head__icon"><Icon name={s.icon} /></span>
          <p className="adm-overline">
            Section {String(index + 1).padStart(2, "0")} <span>/ {SECTIONS.length}</span>
          </p>
          <h1 className="adm-page-title">{s.label}</h1>
          <p className="adm-sec-head__hint">{s.hint}</p>
          {!s.fixed && draft && (
            <div className="adm-sec-head__visible">
              <Toggle
                label={hidden ? "Section masquée sur le site" : "Section affichée sur le site"}
                hint={hidden ? "Elle reste enregistrée ici, prête à revenir." : "Désactivez pour la retirer du site sans rien perdre."}
                checked={!hidden}
                onChange={(on) =>
                  set("hiddenSections", on ? (draft.hiddenSections ?? []).filter((x) => x !== s.id) : [...(draft.hiddenSections ?? []), s.id])
                }
              />
            </div>
          )}
        </header>
        {!draft ? (
          <Loading />
        ) : (
          <div className="adm-sec-body" key={`body-${s.id}`}>
            {Editor({ p: draft, set, projects })}
          </div>
        )}
        <footer className="adm-sec-nav">
          {prev ? (
            <button type="button" className="adm-sec-nav__btn" onClick={() => navigate(`/admin/contenu/${prev.id}`)}>
              <Icon name="left" />
              <span>
                <small>Précédente</small>
                {prev.label}
              </span>
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button type="button" className="adm-sec-nav__btn is-next" onClick={() => navigate(`/admin/contenu/${next.id}`)}>
              <span>
                <small>Suivante</small>
                {next.label}
              </span>
              <Icon name="right" />
            </button>
          )}
        </footer>
      </section>

      {/* ---- aperçu ---- */}
      <aside className="adm-editor__preview">
        <LivePreview draft={draft} target={target} label={targetLabel} tone={s.tone} onPick={onPick} />
      </aside>
      <button
        type="button"
        className="adm-preview-toggle"
        onClick={() => setPreviewOpen((o) => !o)}
        style={{ "--o": previewOpen ? 1 : 0 } as CSSProperties}
      >
        <Icon name={previewOpen ? "x" : "eye"} /> {previewOpen ? "Fermer l'aperçu" : "Aperçu"}
      </button>
    </div>
  );
}
