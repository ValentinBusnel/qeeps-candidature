import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Project, ProjectMedia } from "../../api";
import { Icon } from "../Icons";
import { useSite } from "../../content";
import { useTilt } from "../motion";
import { useStackLogo } from "../../lib/stackLogos";
import "./project-stage.css";

const IMAGE_DURATION = 6000; // une capture reste 6 s à l'écran avant de passer à la suivante

/** Domaine affiché dans la barre du navigateur : premier lien du projet, sinon le titre. */
function domainOf(project: Project) {
  const url = project.links[0]?.url;
  if (!url) return project.title;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Titre court d'un point fort : la partie avant « — ». */
const chipOf = (highlight: string) => highlight.split(/\s[—–-]\s/)[0].trim();

/** Sur téléphone, on ne précharge pas les vidéos entières (mémoire limitée sur iPhone). */
const SMALL_SCREEN = typeof window !== "undefined" && window.matchMedia?.("(max-width: 860px)").matches;

/** Petit logo de techno (28 px) avec le nom en infobulle. */
function MiniLogo({ name, index }: { name: string; index: number }) {
  const src = useStackLogo(name);
  const [failedSrc, setFailed] = useState<string | null>(null);
  const failed = failedSrc === src;
  return (
    <span className="pstage__tech" title={name} style={{ "--t": index } as CSSProperties}>
      {src && !failed ? (
        <img src={src} alt={name} draggable={false} onError={() => setFailed(src)} />
      ) : (
        <span className="pstage__tech-name">{name}</span>
      )}
    </span>
  );
}

/** Titre découpé lettre par lettre (les mots restent insécables) pour l'animation d'entrée. */
function SplitChars({ text }: { text: string }) {
  let n = 0;
  return (
    <>
      {text.split(" ").map((word, w, words) => (
        <span key={w}>
          <span className="pstage__word" aria-hidden="true">
            {[...word].map((ch, c) => (
              <span key={c} className="pstage__char" style={{ "--c": n++ } as CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
          {/* l'espace reste hors du mot insécable, sinon il est avalé en fin de bloc */}
          {w < words.length - 1 && " "}
        </span>
      ))}
    </>
  );
}

/** Description découpée mot par mot : elle se « tape » en fondu à l'arrivée du projet. */
function SplitWords({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <span key={i} aria-hidden="true">
          <span className="pstage__w" style={{ "--w": Math.min(i, 70) } as CSSProperties}>
            {word}
          </span>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </>
  );
}

/**
 * Vitrine compacte d'un projet, pensée pour tenir sur un seul écran :
 * à gauche l'essentiel (statut, titre, description, 3 chiffres clés, stack, liens),
 * à droite la fenêtre de navigateur qui lit les vidéos et photos en chapitres.
 */
export default function ProjectStage({
  project,
  onOpen,
  onFinished,
  onProgress
}: {
  project: Project;
  onOpen: (index: number) => void;
  /** appelé quand le dernier média du projet se termine (mode « story ») */
  onFinished?: () => boolean;
  /** avancement global du projet, de 0 à 1, à chaque image */
  onProgress?: (fraction: number) => void;
}) {
  const { t } = useSite();
  const media = project.media ?? [];
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const imageClock = useRef({ start: 0, elapsed: 0 });
  const tilt = useTilt<HTMLDivElement>({ maxX: 3, maxY: 4, scale: 1.006 });
  // les callbacks changent à chaque rendu du parent : on garde la dernière version sans relancer la boucle
  const finishedRef = useRef(onFinished);
  const progressRef = useRef(onProgress);
  finishedRef.current = onFinished;
  progressRef.current = onProgress;

  const go = useCallback(
    (i: number) => {
      if (!media.length) return;
      const next = (i + media.length) % media.length;
      bars.current.forEach((b, k) => b?.style.setProperty("--p", k < next ? "1" : "0"));
      imageClock.current = { start: performance.now(), elapsed: 0 };
      const v = videos.current[next];
      if (v) v.currentTime = 0;
      setActive(next);
    },
    [media.length]
  );

  /** Fin d'un média : média suivant, ou fin du projet → on prévient le parent (sinon on boucle). */
  const next = useCallback(() => {
    // le parent répond true s'il passe au projet suivant (false s'il est survolé, par ex.)
    if (active === media.length - 1 && finishedRef.current?.()) return;
    if (media.length > 1) {
      go(active + 1);
      return;
    }
    // un seul média : on le relance
    const v = videos.current[active];
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => undefined);
    }
  }, [active, media.length, go]);

  /* On ne lit les vidéos que lorsque la vitrine est visible. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(root);
    return () => io.disconnect();
  }, []);

  /* Lecture : seule la vidéo active tourne. */
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i === active && inView && playing) v.play().catch(() => undefined);
      else v.pause();
    });
  }, [active, inView, playing]);

  /* Progression des chapitres : temps de la vidéo, ou minuterie de 6 s pour une photo. */
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const item = media[active];
      const bar = bars.current[active];
      if (item && bar) {
        let p = 0;
        if (item.type === "video") {
          const v = videos.current[active];
          if (v && v.duration) p = v.currentTime / v.duration;
        } else {
          const clock = imageClock.current;
          const running = inView && playing;
          const elapsed = clock.elapsed + (running ? now - clock.start : 0);
          if (!running) {
            clock.elapsed = elapsed;
            clock.start = now;
          }
          p = elapsed / IMAGE_DURATION;
          if (p >= 1) {
            // on repart de zéro ; si le média change, l'effet est relancé et cette boucle annulée
            imageClock.current = { start: now, elapsed: 0 };
            p = 0;
            next();
          }
        }
        bar.style.setProperty("--p", Math.min(1, p).toFixed(4));
        progressRef.current?.((active + Math.min(1, p)) / media.length);
      }
      raf = requestAnimationFrame(tick);
    };
    imageClock.current = { start: performance.now(), elapsed: imageClock.current.elapsed };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, inView, playing, media, go, next]);

  // badges saisis dans l'admin, sinon le début des points forts
  const keys =
    project.badges && project.badges.length
      ? project.badges.slice(0, 3)
      : project.highlights.slice(0, 3).map((h, i) => ({ icon: ["rocket", "palette", "mail"][i], value: chipOf(h), label: "" }));
  const current: ProjectMedia | undefined = media[active];

  return (
    <article className="pstage" ref={rootRef}>
      {/* ---- L'essentiel ---- */}
      <div className="pstage__info">
        <div className="pstage__meta pstage__in" style={{ "--i": 0 } as CSSProperties}>
          <span className="pstage__status">
            <span className="pstage__pulse" aria-hidden="true" />
            {project.status}
          </span>
          <span>{project.year}</span>
        </div>

        <div>
          <h3 className="pstage__title" aria-label={project.title}>
            <SplitChars text={project.title} />
          </h3>
          <p className="pstage__role pstage__in" style={{ "--i": 2 } as CSSProperties}>
            {project.role}
          </p>
        </div>

        <p className="pstage__desc" aria-label={project.description}>
          <SplitWords text={project.description} />
        </p>

        <div className="pstage__foot">
          <div className="pstage__stack" aria-label="Stack">
            {project.stack.map((s, i) => (
              <MiniLogo key={s} name={s} index={i} />
            ))}
          </div>
          <div className="pstage__actions pstage__in" style={{ "--i": 8 } as CSSProperties}>
            {project.links[0] && (
              <a className="btn btn--primary" href={project.links[0].url} target="_blank" rel="noreferrer">
                {project.links[0].label} <Icon name="external" />
              </a>
            )}
            <button type="button" className="btn btn--secondary" onClick={() => onOpen(active)}>
              <Icon name="expand" /> Tout voir
            </button>
          </div>
        </div>
      </div>

      {/* ---- La fenêtre ---- */}
      <div className="pstage__visual">
        <div className="pstage__frame" ref={tilt.ref} onMouseMove={tilt.onMouseMove} onMouseLeave={tilt.onMouseLeave}>
          <span className="pstage__glare" aria-hidden="true" />
          <div className="pstage__bar">
            <span className="pstage__lights" aria-hidden="true">
              <i /> <i /> <i />
            </span>
            {/* chapitres = onglets du navigateur, avec leur barre de progression */}
            <div className="pstage__tabs" role="tablist" aria-label="Médias du projet">
              {media.map((m, i) => (
                <button
                  key={m.src}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  className={`pstage__chapter ${i === active ? "is-active" : ""}`}
                  onClick={() => go(i)}
                >
                  <Icon name={m.type === "video" ? "play" : "image"} />
                  <span className="pstage__chapter-label">{m.caption}</span>
                  <span className="pstage__chapter-bar" ref={(el) => (bars.current[i] = el)} />
                </button>
              ))}
            </div>
            <span className="pstage__url">
              {project.links[0] && <Icon name="lock" />} {domainOf(project)}
            </span>
          </div>

          <div className="pstage__screen">
            {media.length === 0 && <div className="pstage__empty">{t("proj.empty")}</div>}
            {media.map((m, i) =>
              m.type === "video" ? (
                <video
                  key={m.src}
                  ref={(el) => (videos.current[i] = el)}
                  className={`pstage__media ${i === active ? "is-active" : ""}`}
                  src={m.src}
                  poster={m.poster}
                  muted
                  playsInline
                  preload={i === 0 && !SMALL_SCREEN ? "auto" : "metadata"}
                  onEnded={() => (i === active ? next() : undefined)}
                  loop={media.length === 1 && !onFinished}
                  aria-label={m.caption}
                />
              ) : (
                <img
                  key={m.src}
                  className={`pstage__media ${i === active ? "is-active" : ""}`}
                  src={m.src}
                  alt={m.caption}
                  loading="lazy"
                  draggable={false}
                />
              )
            )}
            {/* reflet lumineux qui balaie l'écran à chaque changement de média */}
            <span key={`sheen-${active}`} className="pstage__sheen" aria-hidden="true" />
            <button
              type="button"
              className="pstage__hit"
              onClick={() => onOpen(active)}
              aria-label={`Agrandir : ${current?.caption ?? project.title}`}
            />
            <div className="pstage__controls">
              <button
                type="button"
                className="pstage__ctrl"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Mettre en pause" : "Lire"}
              >
                <Icon name={playing ? "pause" : "play"} />
              </button>
              <button type="button" className="pstage__ctrl" onClick={() => onOpen(active)} aria-label="Plein écran">
                <Icon name="expand" />
              </button>
            </div>
          </div>
        </div>

        {/* chiffres clés sous la fenêtre */}
        <ul className="pstage__keys">
          {keys.map((k, i) => (
            <li key={`${k.value}-${i}`} className="pstage__key" style={{ "--k": i } as CSSProperties}>
              <span className="pstage__key-icon">
                <Icon name={k.icon || "check"} />
              </span>
              <span className="pstage__key-text">
                <strong>{k.value}</strong>
                {k.label && <small>{k.label}</small>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
