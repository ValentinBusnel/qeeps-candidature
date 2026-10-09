import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Project, ProjectMedia } from "../../api";
import { Icon } from "../Icons";
import { useSite } from "../../content";

const IMAGE_DURATION = 6000; // une capture reste 6 s avant de passer à la suivante
const RATIO = 1920 / 1026; // format des captures et vidéos
const FLY_MS = 720;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Domaine affiché dans la barre du navigateur. */
function domainOf(project: Project) {
  const url = project.links[0]?.url;
  if (!url) return project.title;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type Rect = { left: number; top: number; width: number; height: number };

/** Place de l'écran en mode cinéma : le plus grand possible, au format des vidéos, centré. */
function cinemaRect(withStrip: boolean): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const small = vw < 700;
  const padX = small ? 0 : 48;
  const top = small ? 56 : 76;
  const bottom = withStrip ? (small ? 96 : 128) : small ? 24 : 48;
  const availW = vw - padX * 2;
  const availH = vh - top - bottom;
  const width = Math.min(availW, availH * RATIO);
  const height = width / RATIO;
  return { left: (vw - width) / 2, top: top + (availH - height) / 2, width, height };
}

/** Anime un élément de son ancienne position vers la nouvelle (technique FLIP). */
function fly(el: HTMLElement, from: DOMRect | Rect, radius: [number, number]) {
  const to = el.getBoundingClientRect();
  if (!to.width || !from.width) return;
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  el.animate(
    [
      {
        transformOrigin: "0 0",
        transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`,
        borderRadius: `${radius[0] / sx}px / ${radius[0] / sy}px`
      },
      { transformOrigin: "0 0", transform: "none", borderRadius: `${radius[1]}px` }
    ],
    { duration: FLY_MS, easing: EASE }
  );
}

/**
 * Lecteur du projet : une fenêtre de navigateur dont les onglets sont les chapitres.
 * Le mode cinéma fait sortir l'écran de la page (il s'envole jusqu'au centre), assombrit tout,
 * diffuse ses couleurs autour de lui (« ambilight ») et masque l'interface quand la souris ne bouge plus.
 */
export default function CinemaPlayer({
  project,
  startIndex = 0,
  origin
}: {
  project: Project;
  startIndex?: number;
  /** position de la fenêtre d'où l'on vient (vitrine), pour l'animation d'ouverture */
  origin?: DOMRect | null;
}) {
  const { t } = useSite();
  const media = project.media ?? [];
  const [active, setActive] = useState(Math.min(Math.max(0, startIndex), Math.max(0, media.length - 1)));
  const [playing, setPlaying] = useState(true);
  const [cinema, setCinema] = useState(false);
  const [cineOut, setCineOut] = useState(false); // fondu de sortie du mode cinéma
  const [rect, setRect] = useState<Rect | null>(null);
  const [idle, setIdle] = useState(false);

  const frameRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const images = useRef<(HTMLImageElement | null)[]>([]);
  const tabBars = useRef<(HTMLSpanElement | null)[]>([]);
  const stripBars = useRef<(HTMLSpanElement | null)[]>([]);
  const imageClock = useRef({ start: performance.now(), elapsed: 0 });
  const flyFrom = useRef<DOMRect | Rect | null>(null);
  const idleTimer = useRef(0);

  const go = useCallback(
    (i: number) => {
      if (!media.length) return;
      const next = (i + media.length) % media.length;
      [tabBars, stripBars].forEach((list) => list.current.forEach((b, k) => b?.style.setProperty("--p", k < next ? "1" : "0")));
      imageClock.current = { start: performance.now(), elapsed: 0 };
      const v = videos.current[next];
      if (v) v.currentTime = 0;
      setActive(next);
      setPlaying(true);
    },
    [media.length]
  );

  /* ---- Ouverture : la fenêtre part de la vitrine et se pose dans la fiche ---- */
  useLayoutEffect(() => {
    if (origin && frameRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fly(frameRef.current, origin, [18, 22]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Mode cinéma ---- */
  const toggleCinema = useCallback(() => {
    const el = screenRef.current;
    if (!el) return;
    flyFrom.current = el.getBoundingClientRect();
    if (cinema) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
      setCinema(false);
      setCineOut(true);
      window.setTimeout(() => setCineOut(false), 520);
    } else {
      setRect(cinemaRect(media.length > 1));
      setCinema(true);
    }
  }, [cinema, media.length]);

  // l'écran vient d'être déplacé (cinéma ↔ page) : on l'anime depuis son ancienne place
  useLayoutEffect(() => {
    const el = screenRef.current;
    const from = flyFrom.current;
    flyFrom.current = null;
    if (!el || !from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    fly(el, from, cinema ? [0, 16] : [16, 0]);
  }, [cinema]);

  useEffect(() => {
    if (!cinema) return;
    const onResize = () => setRect(cinemaRect(media.length > 1));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [cinema, media.length]);

  const toggleFullscreen = () => {
    const root = (frameRef.current?.closest(".psheet") as HTMLElement | null) ?? document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else root.requestFullscreen?.().catch(() => undefined);
  };

  /* Interface qui s'efface quand la souris ne bouge plus (cinéma, en lecture). */
  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 2400);
  }, []);
  useEffect(() => {
    if (cinema) wake();
    else setIdle(false);
    return () => window.clearTimeout(idleTimer.current);
  }, [cinema, wake]);

  /* ---- Clavier : espace, flèches, C (cinéma), F (plein écran), Échap ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowRight") go(active + 1);
      else if (e.key === "ArrowLeft") go(active - 1);
      else if (e.key === "c" || e.key === "C") toggleCinema();
      else if ((e.key === "f" || e.key === "F") && cinema) toggleFullscreen();
      else if (e.key === "Escape" && cinema) {
        e.stopPropagation(); // ne ferme pas la fiche, on quitte seulement le cinéma
        toggleCinema();
      } else return;
      if (cinema) wake();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, cinema, go, toggleCinema, wake]);

  /* ---- Lecture ---- */
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      // lecture auto refusée par le navigateur : on affiche le grand bouton lecture
      if (i === active && playing)
        v.play().catch((err: DOMException) => err?.name === "NotAllowedError" && setPlaying(false));
      else v.pause();
    });
  }, [active, playing]);

  /* Progression (barre de lecture, onglets, bande du cinéma) + reflet ambilight. */
  useEffect(() => {
    let raf = 0;
    let lastAmbi = 0;
    const tick = (now: number) => {
      const item = media[active];
      let p = 0;
      if (item?.type === "video") {
        const v = videos.current[active];
        if (v && v.duration) {
          p = v.currentTime / v.duration;
        }
      } else if (item) {
        const c = imageClock.current;
        const elapsed = c.elapsed + (playing ? now - c.start : 0);
        if (!playing) {
          c.elapsed = elapsed;
          c.start = now;
        }
        p = elapsed / IMAGE_DURATION;
        if (p >= 1 && media.length > 1) {
          go(active + 1);
          return;
        }
      }
      const pv = Math.min(1, p).toFixed(4);
      tabBars.current[active]?.style.setProperty("--p", pv);
      stripBars.current[active]?.style.setProperty("--p", pv);
      // ambilight : on recopie l'image courante en tout petit, le flou CSS fait le reste
      const canvas = canvasRef.current;
      if (canvas && now - lastAmbi > 120) {
        lastAmbi = now;
        const src = item?.type === "video" ? videos.current[active] : images.current[active];
        const ctx = canvas.getContext("2d");
        try {
          if (ctx && src) ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
        } catch {
          /* image pas encore prête */
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, playing, media, go]);

  /* Clic sur l'image : dans la page on passe en grand, en grand on met en pause / relance. */
  const onScreenClick = () => (cinema ? setPlaying((p) => !p) : toggleCinema());

  if (!media.length) return null;
  const current: ProjectMedia = media[active];
  const cinemaStyle: CSSProperties | undefined =
    cinema && rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : undefined;

  return (
    <div
      className={`cplayer ${cinema ? "is-cinema" : ""} ${cineOut ? "is-landing" : ""} ${idle && playing ? "is-idle" : ""}`}
      onMouseMove={cinema ? wake : undefined}
    >
      {/* ---- Fond du mode cinéma ---- */}
      {(cinema || cineOut) && (
        <div className={`cine ${cineOut ? "is-out" : ""}`} onClick={toggleCinema}>
          <canvas
            ref={canvasRef}
            className="cine__ambi"
            width={48}
            height={26}
            style={rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : undefined}
            aria-hidden="true"
          />
          <div className="cine__top" onClick={(e) => e.stopPropagation()}>
            <div className="cine__title">
              <strong>{project.title}</strong>
              <span key={active}>{current.caption}</span>
            </div>
            <div className="cine__keys" aria-hidden="true">
              <kbd>Espace</kbd> {t("cine.play")} <kbd>←</kbd>
              <kbd>→</kbd> {t("cine.media")} <kbd>F</kbd> {t("cine.full")} <kbd>Échap</kbd> {t("cine.quit")}
            </div>
            <button type="button" className="cine__close" onClick={toggleCinema} aria-label="Quitter le mode cinéma">
              <Icon name="x" />
            </button>
          </div>
          {media.length > 1 && (
            <div className="cine__strip" onClick={(e) => e.stopPropagation()}>
              {media.map((m, i) => (
                <button
                  key={m.src}
                  type="button"
                  className={`cine__chapter ${i === active ? "is-active" : ""}`}
                  onClick={() => go(i)}
                  style={{ "--i": i } as CSSProperties}
                >
                  <span className="cine__thumb">
                    <img src={m.type === "video" ? m.poster : m.src} alt="" />
                    {m.type === "video" && <Icon name="play" />}
                  </span>
                  <span className="cine__chapter-text">
                    <small>{String(i + 1).padStart(2, "0")}</small>
                    {m.caption}
                  </span>
                  <span className="cine__bar" ref={(el) => (stripBars.current[i] = el)} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- La fenêtre ---- */}
      <div className="cplayer__frame" ref={frameRef}>
        <div className="cplayer__bar">
          <span className="cplayer__lights" aria-hidden="true">
            <i /> <i /> <i />
          </span>
          <div className="cplayer__tabs" role="tablist" aria-label="Médias du projet">
            {media.map((m, i) => (
              <button
                key={m.src}
                type="button"
                role="tab"
                aria-selected={i === active}
                className={`cplayer__tab ${i === active ? "is-active" : ""}`}
                onClick={() => go(i)}
              >
                <Icon name={m.type === "video" ? "play" : "image"} />
                <span className="cplayer__tab-label">{m.caption}</span>
                <span className="cplayer__tab-bar" ref={(el) => (tabBars.current[i] = el)} />
              </button>
            ))}
          </div>
          <span className="cplayer__url">
            {project.links[0] && <Icon name="lock" />} {domainOf(project)}
          </span>
        </div>

        {/* l'emplacement garde sa place quand l'écran part en mode cinéma */}
        <div className="cplayer__slot">
          <div className="cplayer__screen" ref={screenRef} style={cinemaStyle}>
            {media.map((m, i) =>
              m.type === "video" ? (
                <video
                  key={m.src}
                  ref={(el) => (videos.current[i] = el)}
                  className={`cplayer__media ${i === active ? "is-active" : ""}`}
                  src={m.src}
                  poster={m.poster}
                  muted
                  playsInline
                  preload={i === active ? "auto" : "metadata"}
                  onEnded={() => (i === active ? go(active + 1) : undefined)}
                  loop={media.length === 1}
                  onClick={onScreenClick}
                  aria-label={m.caption}
                />
              ) : (
                <img
                  key={m.src}
                  ref={(el) => (images.current[i] = el)}
                  className={`cplayer__media ${i === active ? "is-active" : ""}`}
                  src={m.src}
                  alt={m.caption}
                  draggable={false}
                  onClick={onScreenClick}
                />
              )
            )}
            {/* grand bouton lecture quand la vidéo est en pause */}
            <button
              type="button"
              className={`cplayer__bigplay ${playing || !cinema ? "" : "is-shown"}`}
              onClick={() => setPlaying(true)}
              aria-label="Lecture"
              tabIndex={playing ? -1 : 0}
            >
              <Icon name="play" />
            </button>
            {/* dans la page : un seul bouton pour passer en grand (cliquer la vidéo fait pareil).
                En grand, aucune commande : clic = pause / lecture, Échap ou la croix pour sortir. */}
            {!cinema && (
              <button type="button" className="cplayer__expand" onClick={toggleCinema} aria-label="Agrandir la vidéo">
                <Icon name="fullscreen" />
                <span>{t("proj.expand")}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
