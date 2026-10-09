import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import type { Project } from "../../api";
import { Icon } from "../Icons";
import { useSite } from "../../content";
import ProjectStage from "./ProjectStage";
import "./project-switcher.css";

const LEAVE_MS = 420;

/** Vignette d'un projet : première photo, sinon l'image d'aperçu de la première vidéo. */
const coverOf = (p: Project) => p.media?.find((m) => m.type === "image")?.src ?? p.media?.[0]?.poster;

/**
 * Sélecteur de projets : une pastille par projet (indicateur blanc qui glisse, comme les
 * onglets de Qeeps), flèches, clavier et swipe. Le projet sortant part en fondu flouté dans le
 * sens de la navigation, le suivant entre en cascade (en-tête, fenêtre, chapitres, détails)
 * et la hauteur du bloc s'adapte en douceur.
 */
/** Carte flottante d'aperçu d'un projet (au survol d'un onglet ou d'une flèche). */
function Peek({ project, label, align = "right" }: { project: Project; label: string; align?: "left" | "right" }) {
  const cover = coverOf(project);
  return (
    <span className={`pswitch__peek pswitch__peek--${align}`} aria-hidden="true">
      <span className="pswitch__peek-thumb">{cover && <img src={cover} alt="" />}</span>
      <span className="pswitch__peek-text">
        <small>{label}</small>
        <strong>{project.title}</strong>
        <em>{project.tagline}</em>
      </span>
    </span>
  );
}

export default function ProjectSwitcher({
  projects,
  onOpen
}: {
  projects: Project[];
  onOpen: (project: Project, index: number, origin?: DOMRect | null) => void;
}) {
  const [index, setIndex] = useState(0);
  const { t } = useSite();
  const [dir, setDir] = useState<1 | -1>(1);
  const [leaving, setLeaving] = useState<{ project: Project; key: number } | null>(null);
  const [enterKey, setEnterKey] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, right: 0 });
  const hovered = useRef(false);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  /* Première apparition à l'écran : on lance l'animation d'entrée. Les projets arrivent
     après un appel à l'API, donc on observe dès que le bloc existe (dépendance sur leur nombre). */
  useEffect(() => {
    const el = rootRef.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [projects.length, inView]);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const touchX = useRef<number | null>(null);
  const leaveTimer = useRef(0);

  const go = useCallback(
    (next: number) => {
      const n = projects.length;
      if (n < 2) return;
      const target = ((next % n) + n) % n;
      if (target === index) return;
      // sens : le plus court chemin, pour que « suivant » depuis le dernier reparte vers la droite
      const forward = (target - index + n) % n <= n / 2;
      setDir(forward ? 1 : -1);
      setLeaving({ project: projects[index], key: Date.now() });
      setIndex(target);
      setEnterKey((k) => k + 1);
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = window.setTimeout(() => setLeaving(null), LEAVE_MS);
      indicatorRef.current?.style.setProperty("--ring", "0");
      // garde l'onglet actif visible sur mobile
      tabRefs.current[target]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    },
    [index, projects]
  );

  // aperçu de l'admin : afficher un projet précis
  useEffect(() => {
    const onShow = (e: Event) => {
      const i = projects.findIndex((p) => p.slug === (e as CustomEvent<string>).detail);
      if (i >= 0) go(i);
    };
    window.addEventListener("project:show", onShow);
    return () => window.removeEventListener("project:show", onShow);
  }, [projects, go]);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  /* Indicateur blanc qui glisse sous l'onglet actif. */
  useLayoutEffect(() => {
    const place = () => {
      const tab = tabRefs.current[index];
      const bar = tabsRef.current;
      if (!tab || !bar) return;
      setIndicator({ left: tab.offsetLeft, right: bar.clientWidth - tab.offsetLeft - tab.offsetWidth });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [index, projects.length]);

  /* Hauteur animée : on suit la hauteur réelle du projet affiché. */
  useEffect(() => {
    const el = currentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    setHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [index]);

  /* Flèches du clavier quand le sélecteur a le focus. */
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go(index + 1);
    if (e.key === "ArrowLeft") go(index - 1);
  };

  /* Flèches « magnétiques » : elles suivent légèrement le curseur. */
  const magnet = {
    onMouseMove: (e: MouseEvent<HTMLButtonElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.3;
      const y = (e.clientY - r.top - r.height / 2) * 0.3;
      e.currentTarget.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    },
    onMouseLeave: (e: MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.translate = "0 0";
    }
  };

  if (!projects.length) return null;
  const current = projects[index];
  const nextProject = projects[(index + 1) % projects.length];
  const prevProject = projects[(index - 1 + projects.length) % projects.length];

  return (
    <div ref={rootRef} className="pswitch" style={{ "--dir": dir } as CSSProperties} onKeyDown={onKeyDown}>
      <div className="pswitch__bar">
        <div className="pswitch__tabs" ref={tabsRef} role="tablist" aria-label="Projets">
          {/* indicateur « liquide » : le bord avant part en premier, l'arrière suit, il s'étire puis se resserre */}
          <span
            ref={indicatorRef}
            className="pswitch__indicator"
            style={{
              left: indicator.left,
              right: indicator.right,
              transition:
                dir === 1
                  ? "right 0.38s cubic-bezier(0.3, 0.7, 0.2, 1), left 0.62s 0.07s cubic-bezier(0.3, 0.7, 0.2, 1)"
                  : "left 0.38s cubic-bezier(0.3, 0.7, 0.2, 1), right 0.62s 0.07s cubic-bezier(0.3, 0.7, 0.2, 1)"
            }}
            aria-hidden="true"
          />
          {projects.map((p, i) => (
            <button
              key={p.slug}
              ref={(el) => (tabRefs.current[i] = el)}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`pswitch__tab ${i === index ? "is-active" : ""}`}
              onClick={() => go(i)}
            >
              <span className="pswitch__num">{String(i + 1).padStart(2, "0")}</span>
              <span className="pswitch__name">{p.title}</span>
              {i !== index && <Peek project={p} label={i > index ? t("proj.next") : t("proj.prev")} align="left" />}
            </button>
          ))}
        </div>

        {projects.length > 1 && (
          <div className="pswitch__nav">
            <span className="pswitch__count" aria-live="polite">
              <span key={index} className="pswitch__count-num">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="pswitch__count-total"> / {String(projects.length).padStart(2, "0")}</span>
            </span>
            <button type="button" className="pswitch__arrow" onClick={() => go(index - 1)} aria-label="Projet précédent" {...magnet}>
              <Icon name="left" />
              <Peek project={prevProject} label="Projet précédent" />
            </button>
            <button
              type="button"
              className="pswitch__arrow pswitch__arrow--next"
              onClick={() => go(index + 1)}
              aria-label="Projet suivant"
              {...magnet}
            >
              <Icon name="right" />
              <Peek project={nextProject} label={t("proj.next")} />
            </button>
          </div>
        )}
      </div>

      <div
        className="pswitch__viewport"
        ref={viewportRef}
        style={{ height }}
        onMouseEnter={() => (hovered.current = true)}
        onMouseLeave={() => (hovered.current = false)}
        onMouseMove={(e) => {
          // halo lumineux qui suit le curseur sur le fond de la carte
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
          e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
        }}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          // on ignore les swipes qui partent des chapitres (qui défilent horizontalement)
          const fromChapters = (e.target as HTMLElement).closest(".pstage__chapters");
          if (!fromChapters && Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1));
          touchX.current = null;
        }}
      >
        {enterKey > 0 && <span key={`wave-${enterKey}`} className="pswitch__wave" aria-hidden="true" />}
        {leaving && (
          <div key={`leave-${leaving.key}`} className="pswitch__slide is-leaving" aria-hidden="true">
            <ProjectStage project={leaving.project} onOpen={() => undefined} />
          </div>
        )}
        <div
          key={`enter-${enterKey}`}
          ref={currentRef}
          className={`pswitch__slide ${enterKey || inView ? "is-entering" : "is-waiting"}`}
        >
          <ProjectStage
            project={current}
            onOpen={(i) => onOpen(current, i, currentRef.current?.querySelector(".pstage__frame")?.getBoundingClientRect() ?? null)}
            onProgress={(f) => indicatorRef.current?.style.setProperty("--ring", f.toFixed(4))}
            onFinished={() => {
              // mode « story » : à la fin du dernier média on passe au projet suivant, sauf si on lit la carte
              if (hovered.current || projects.length < 2) return false;
              go(index + 1);
              return true;
            }}
          />
        </div>
      </div>
    </div>
  );
}
