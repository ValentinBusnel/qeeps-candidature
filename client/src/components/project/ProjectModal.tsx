import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Project } from "../../api";
import { Icon } from "../Icons";
import { useSite } from "../../content";
import { Reveal } from "../motion";
import StackLogo from "../StackLogo";
import CinemaPlayer from "./CinemaPlayer";
import "./project-modal.css";

/** « Titre — texte » → { title, text } */
const splitHighlight = (h: string) => {
  const [title, ...rest] = h.split(/\s[—–-]\s/);
  const text = rest.join(" — ").trim();
  return { title: title.trim(), text: text.charAt(0).toUpperCase() + text.slice(1) };
};
const coverOf = (p: Project) => p.media?.find((m) => m.type === "image")?.src ?? p.media?.[0]?.poster;

/** Titre découpé lettre par lettre (les mots restent insécables). */
function SplitTitle({ text }: { text: string }) {
  let n = 0;
  const words = text.split(" ");
  return (
    <>
      {words.map((word, w) => (
        <span key={w}>
          <span className="psheet__word" aria-hidden="true">
            {[...word].map((ch, c) => (
              <span key={c} className="psheet__char" style={{ "--c": n++ } as CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
          {w < words.length - 1 && " "}
        </span>
      ))}
    </>
  );
}

/**
 * Fiche projet : une feuille qui monte sur la page, la fenêtre de la vitrine s'y envole pour
 * devenir le lecteur (mode cinéma possible), puis le récit du projet en blocs façon Qeeps,
 * et le projet suivant en bas pour enchaîner sans refermer.
 */
export default function ProjectModal({
  project,
  projects = [],
  onClose,
  onNavigate,
  startIndex = 0,
  origin
}: {
  project: Project;
  projects?: Project[];
  onClose: () => void;
  onNavigate?: (project: Project) => void;
  startIndex?: number;
  origin?: DOMRect | null;
}) {
  const [closing, setClosing] = useState(false);
  const { t } = useSite();
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 420);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  // changement de projet depuis la fiche : on remonte en haut
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [project.slug]);

  const pos = projects.findIndex((p) => p.slug === project.slug);
  const next = projects.length > 1 && pos >= 0 ? projects[(pos + 1) % projects.length] : null;
  const prev = projects.length > 1 && pos >= 0 ? projects[(pos - 1 + projects.length) % projects.length] : null;
  const nextCover = next ? coverOf(next) : undefined;

  return (
    <div className={`psheet ${closing ? "is-closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="psheet-title">
      <div className="psheet__backdrop" onClick={close} />

      <div className="psheet__panel">
        {/* barre du haut : titre qui apparaît au scroll, projets voisins, fermer */}
        <header className={`psheet__top ${scrolled ? "is-scrolled" : ""}`}>
          <span className="psheet__progress" aria-hidden="true">
            <span ref={progressRef} />
          </span>
          <div className="psheet__top-title">
            <span className="psheet__status">
              <span className="psheet__pulse" aria-hidden="true" />
              {project.status}
            </span>
            <strong>{project.title}</strong>
          </div>
          <div className="psheet__top-actions">
            {prev && onNavigate && (
              <button type="button" className="psheet__icon" onClick={() => onNavigate(prev)} aria-label={`Projet précédent : ${prev.title}`}>
                <Icon name="left" />
              </button>
            )}
            {next && onNavigate && (
              <button type="button" className="psheet__icon" onClick={() => onNavigate(next)} aria-label={`Projet suivant : ${next.title}`}>
                <Icon name="right" />
              </button>
            )}
            <button type="button" className="psheet__icon psheet__icon--close" onClick={close} aria-label="Fermer">
              <Icon name="x" />
            </button>
          </div>
        </header>

        <div
          className="psheet__scroll"
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setScrolled(el.scrollTop > 40);
            const max = el.scrollHeight - el.clientHeight;
            progressRef.current?.style.setProperty("--p", (max > 0 ? el.scrollTop / max : 0).toFixed(4));
          }}
        >
          <div key={project.slug} className="psheet__content">
            {/* ---- Ouverture ---- */}
            <section className="psheet__hero">
              <div className="psheet__intro">
                <p className="psheet__meta psheet__rise" style={{ "--d": 0 } as CSSProperties}>
                  <span className="psheet__status">
                    <span className="psheet__pulse" aria-hidden="true" />
                    {project.status}
                  </span>
                  <span>{project.year}</span>
                  <span className="psheet__dot" />
                  <span>{project.role}</span>
                </p>
                <h2 id="psheet-title" className="psheet__title" aria-label={project.title}>
                  <SplitTitle text={project.title} />
                </h2>
                <p className="psheet__tagline psheet__rise" style={{ "--d": 3 } as CSSProperties}>
                  {project.tagline}
                </p>
              </div>

              <div className="psheet__player">
                <CinemaPlayer key={project.slug} project={project} startIndex={startIndex} origin={origin} />
              </div>
            </section>

            {/* ---- L'essentiel : le récit, ce qui a été construit, la stack ---- */}
            <section className="psheet__essentials">
              <Reveal className="psheet__story">
                <p className="psheet__lead">{project.description}</p>
                {project.highlights.length > 0 && (
                  <ol className="psheet__points">
                    {project.highlights.map((h, i) => {
                      const { title, text } = splitHighlight(h);
                      return (
                        <li key={h} style={{ "--i": i } as CSSProperties}>
                          <span className="psheet__points-num">{String(i + 1).padStart(2, "0")}</span>
                          <span>
                            <strong>{title}</strong>
                            {text && <small>{text}</small>}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Reveal>
              <Reveal className="psheet__side" delay={120}>
                <p className="psheet__label">{t("proj.stack")}</p>
                <div className="psheet__stack">
                  {project.stack.map((s, i) => (
                    <span key={s} className="psheet__tech" style={{ "--i": i } as CSSProperties}>
                      <StackLogo name={s} />
                    </span>
                  ))}
                </div>
                {project.links[0] && (
                  <a href={project.links[0].url} target="_blank" rel="noreferrer" className="btn btn--primary psheet__visit">
                    {project.links[0].label} <Icon name="external" />
                  </a>
                )}
              </Reveal>
            </section>

            {/* ---- Projet suivant ---- */}
            {next && onNavigate && (
              <Reveal className="psheet__next-wrap">
                <button type="button" className="psheet__next" onClick={() => onNavigate(next)}>
                  <span className="psheet__next-text">
                    <small>{t("proj.next")}</small>
                    <strong>{next.title}</strong>
                    <span>{next.tagline}</span>
                    <span className="psheet__next-go">
                      {t("proj.discover")} <Icon name="arrow" />
                    </span>
                  </span>
                  <span className="psheet__next-shot" aria-hidden="true">
                    {nextCover && <img src={nextCover} alt="" />}
                  </span>
                </button>
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
