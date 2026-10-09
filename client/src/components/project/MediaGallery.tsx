import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { ProjectMedia } from "../../api";
import { Icon } from "../Icons";

/** Placeholder affiché tant que le fichier n'a pas été déposé dans client/public. */
function MissingMedia({ media }: { media: ProjectMedia }) {
  return (
    <div className="media-missing">
      <span className="media-missing__icon">
        <Icon name={media.type === "video" ? "play" : "image"} />
      </span>
      <p>{media.caption}</p>
      <code>client/public{media.src}</code>
    </div>
  );
}

function videoSources(src: string) {
  return /\.mp4$/i.test(src) ? [src, src.replace(/\.mp4$/i, ".webm")] : [src];
}

function Slide({ media, active }: { media: ProjectMedia; active: boolean }) {
  const [missing, setMissing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // La vidéo active se lance toute seule ; les autres se mettent en pause
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) v.play().catch(() => {});
    else v.pause();
  }, [active]);

  if (missing) return <MissingMedia media={media} />;

  return media.type === "video" ? (
    <video ref={videoRef} poster={media.poster} muted loop playsInline controls preload="metadata">
      {/* une version .webm optionnelle à côté du .mp4 élargit la compatibilité */}
      {videoSources(media.src).map((src, i, all) => (
        <source key={src} src={src} onError={i === all.length - 1 ? () => setMissing(true) : undefined} />
      ))}
    </video>
  ) : (
    <img src={media.src} alt={media.caption} loading="lazy" onError={() => setMissing(true)} />
  );
}

function Thumb({ media }: { media: ProjectMedia }) {
  const [missing, setMissing] = useState(false);
  const src = media.type === "video" ? media.poster : media.src;
  return (
    <>
      {src && !missing ? (
        <img src={src} alt="" loading="lazy" onError={() => setMissing(true)} />
      ) : (
        <span className="thumb__empty">
          <Icon name={media.type === "video" ? "play" : "image"} />
        </span>
      )}
      {media.type === "video" && (
        <span className="thumb__play">
          <Icon name="play" />
        </span>
      )}
    </>
  );
}

/** Galerie photos / vidéos : scène principale, flèches, vignettes, plein écran, clavier et swipe. */
export default function MediaGallery({ items, startIndex = 0 }: { items: ProjectMedia[]; startIndex?: number }) {
  const [index, setIndex] = useState(Math.min(Math.max(0, startIndex), Math.max(0, items.length - 1)));
  const [direction, setDirection] = useState<1 | -1>(1);
  const [fullscreen, setFullscreen] = useState(false);
  const touchX = useRef<number | null>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (next: number) => {
      if (!items.length) return;
      const target = (next + items.length) % items.length;
      setDirection(next > index ? 1 : -1);
      setIndex(target);
    },
    [index, items.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "Escape" && fullscreen) {
        e.stopPropagation();
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [go, index, fullscreen]);

  // Garde la vignette active visible
  useEffect(() => {
    thumbsRef.current
      ?.querySelector<HTMLElement>(`[data-i="${index}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [index]);

  if (!items.length) return null;
  const current = items[index];

  return (
    <div className="gallery">
      <div
        className="gallery__stage"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
          touchX.current = null;
        }}
      >
        {items.map((m, i) => (
          <div
            key={m.src}
            className={`gallery__slide ${i === index ? "is-active" : ""}`}
            style={{ "--dir": direction } as CSSProperties}
            aria-hidden={i !== index}
          >
            <Slide media={m} active={i === index} />
          </div>
        ))}

        {items.length > 1 && (
          <>
            <button type="button" className="gallery__nav gallery__nav--prev" onClick={() => go(index - 1)} aria-label="Média précédent">
              <Icon name="left" />
            </button>
            <button type="button" className="gallery__nav gallery__nav--next" onClick={() => go(index + 1)} aria-label="Média suivant">
              <Icon name="right" />
            </button>
          </>
        )}
        <button type="button" className="gallery__expand" onClick={() => setFullscreen(true)} aria-label="Plein écran">
          <Icon name="expand" />
        </button>
        <div className="gallery__caption" key={index}>
          <span className="tag tag--cyan">
            {index + 1} / {items.length}
          </span>
          {current.caption}
        </div>
        <div className="gallery__progress">
          <span style={{ width: `${((index + 1) / items.length) * 100}%` }} />
        </div>
      </div>

      {fullscreen &&
        createPortal(
          <div className="lightbox" onClick={() => setFullscreen(false)} role="dialog" aria-label="Média en plein écran">
            <div className="lightbox__media" key={index} onClick={(e) => e.stopPropagation()}>
              <Slide media={current} active />
            </div>
            <button type="button" className="lightbox__close" onClick={() => setFullscreen(false)} aria-label="Fermer">
              <Icon name="x" />
            </button>
            {items.length > 1 && (
              <>
                <button
                  type="button"
                  className="lightbox__nav lightbox__nav--prev"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(index - 1);
                  }}
                  aria-label="Média précédent"
                >
                  <Icon name="left" />
                </button>
                <button
                  type="button"
                  className="lightbox__nav lightbox__nav--next"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(index + 1);
                  }}
                  aria-label="Média suivant"
                >
                  <Icon name="right" />
                </button>
              </>
            )}
            <p className="lightbox__caption" key={`c${index}`}>
              {index + 1} / {items.length} · {current.caption}
            </p>
          </div>,
          document.body
        )}

      {items.length > 1 && (
        <div className="gallery__thumbs" ref={thumbsRef}>
          {items.map((m, i) => (
            <button
              key={m.src}
              type="button"
              data-i={i}
              className={`thumb ${i === index ? "is-active" : ""}`}
              onClick={() => go(i)}
              aria-label={m.caption}
            >
              <Thumb media={m} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
