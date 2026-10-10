import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { AppDoc, Profile } from "../../api";
import { useSite } from "../../content";
import { drawPage, openPdf, type PdfDoc } from "../../lib/pdf";
import { Icon } from "../Icons";
import "./documents.css";

/**
 * Bloc « Ma candidature » : le dossier en trois cartes (CV, recommandation, motivation).
 * - Les cartes sont de vraies miniatures : la 1re page de chaque PDF (pdf.js) ou la lettre
 *   elle-même, réduite. Elles flottent doucement, s'écartent au survol du bloc, et la carte
 *   survolée se redresse et se soulève.
 * - Un clic ouvre la liseuse : la feuille s'envole depuis la carte jusqu'au centre de l'écran
 *   (transition « FLIP »), puis les pages se dessinent ; la lettre de motivation s'écrit
 *   paragraphe par paragraphe. On passe d'un document à l'autre sans refermer (onglets, ← →).
 */

export const DOC_TONES: Record<AppDoc["tone"], { fg: string; bg: string }> = {
  cyan: { fg: "#176c79", bg: "#ddf7f7" },
  green: { fg: "#2f7d55", bg: "#d1ede0" },
  pink: { fg: "#a4475f", bg: "#f3dde2" },
  sand: { fg: "#94681f", bg: "#f6e9d3" }
};
const toneStyle = (d: AppDoc) => {
  const t = DOC_TONES[d.tone] ?? DOC_TONES.cyan;
  return { "--doc-fg": t.fg, "--doc-bg": t.bg } as CSSProperties;
};
const REDUCED = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const paragraphs = (body = "") => body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/* ------------------------------ la lettre ------------------------------ */

/** Lettre rédigée sur le site, mise en page comme une vraie feuille (aussi utilisée en miniature). */
function Letter({ doc, profile, live = false }: { doc: AppDoc; profile: Profile; live?: boolean }) {
  const { t } = useSite();
  const paras = paragraphs(doc.body);
  const step = (i: number) => ({ "--d": `${0.35 + i * 0.13}s` }) as CSSProperties;
  return (
    <div className={`letter ${live ? "is-live" : ""}`}>
      <header className="letter__head">
        <p className="letter__brand">
          {t("brand")}
          <span>.</span>
        </p>
        <div className="letter__from">
          <b>{profile.fullName}</b>
          <span>{profile.title}</span>
        </div>
      </header>
      {doc.place && (
        <p className="letter__place lt-in" style={step(0)}>
          {doc.place}
        </p>
      )}
      {doc.greeting && (
        <p className="letter__greeting lt-in" style={step(1)}>
          {doc.greeting}
        </p>
      )}
      {paras.map((p, i) => (
        <p key={i} className="letter__p lt-in" style={step(i + 2)}>
          {p}
        </p>
      ))}
      <footer className="letter__end lt-in" style={step(paras.length + 2)}>
        {doc.closing && <p className="letter__closing">{doc.closing}</p>}
        {doc.signature && (
          <p className="letter__signature">
            {doc.signature}
            <svg viewBox="0 0 220 14" preserveAspectRatio="none" aria-hidden="true">
              <path d="M2 9 C 40 3, 80 13, 120 7 S 190 4, 218 8" pathLength={1} />
            </svg>
          </p>
        )}
      </footer>
    </div>
  );
}

/* ------------------------------ miniatures ------------------------------ */

/** 1re page d'un PDF, dessinée quand le bloc approche de l'écran. */
function PdfThumb({ url, width, ready }: { url: string; width: number; ready: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"wait" | "ok" | "error">("wait");
  useEffect(() => {
    if (!ready || !url) return;
    let alive = true;
    openPdf(url)
      .then((doc) => ref.current && drawPage(doc, 1, ref.current, width))
      .then(() => alive && setState("ok"))
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [url, width, ready]);
  return (
    <div className={`doc-thumb doc-thumb--pdf is-${state}`}>
      <canvas ref={ref} />
      {state !== "ok" && <Skeleton />}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="doc-skeleton" aria-hidden="true">
      <i style={{ width: "46%" }} />
      <i style={{ width: "30%" }} />
      <i />
      <i />
      <i style={{ width: "82%" }} />
      <i />
      <i style={{ width: "64%" }} />
    </div>
  );
}

/** Miniature de la lettre : la vraie lettre (680 px de large) réduite à la taille de la carte. */
function LetterThumb({ doc, profile, width }: { doc: AppDoc; profile: Profile; width: number }) {
  return (
    <div className="doc-thumb doc-thumb--letter">
      <div className="doc-thumb__scaler" style={{ transform: `scale(${width / 680})` }}>
        <Letter doc={doc} profile={profile} />
      </div>
    </div>
  );
}

/* ------------------------------ les cartes ------------------------------ */

const CARD_W = 150;

export function DocsVisual({ profile }: { profile: Profile }) {
  const { t } = useSite();
  const docs = profile.documents ?? [];
  const root = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const [near, setNear] = useState(false);
  const [open, setOpen] = useState<{ index: number; from: CardGeo | null } | null>(null);

  // les miniatures PDF ne se dessinent que lorsque le bloc approche de l'écran
  useEffect(() => {
    const el = root.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  const openAt = useCallback(
    (index: number) => {
      setOpen({ index, from: cardGeo(cards.current[index]) });
    },
    []
  );

  // aperçu de l'admin : « doc:<id> » ouvre le document, toute autre cible le referme
  useEffect(() => {
    const onOpen = (e: Event) => {
      const i = docs.findIndex((d) => d.id === (e as CustomEvent<string>).detail);
      if (i >= 0) openAt(i);
    };
    const onClose = () => setOpen(null);
    window.addEventListener("doc:open", onOpen);
    window.addEventListener("doc:close", onClose);
    return () => {
      window.removeEventListener("doc:open", onOpen);
      window.removeEventListener("doc:close", onClose);
    };
  }, [docs, openAt]);

  if (!docs.length) return null;
  const n = docs.length;
  return (
    <div className="docs" id="candidature" ref={root}>
      <div className="docs__deck">
        {docs.map((d, i) => {
          const k = i - (n - 1) / 2;
          return (
            <button
              key={d.id || i}
              ref={(el) => (cards.current[i] = el)}
              type="button"
              className={`doc-card ${open?.index === i ? "is-away" : ""}`}
              style={{ ...toneStyle(d), "--k": k, "--ak": Math.abs(k), "--i": i } as CSSProperties}
              onClick={() => openAt(i)}
              aria-label={`${t("docs.open")} : ${d.title}`}
            >
              <span className="doc-card__float">
                <span className="doc-card__sheet">
                  {d.kind === "pdf" ? (
                    <PdfThumb url={d.file ?? ""} width={CARD_W} ready={near} />
                  ) : (
                    <LetterThumb doc={d} profile={profile} width={CARD_W} />
                  )}
                  <span className="doc-card__shade" />
                  <span className="doc-card__open">
                    {t("docs.open")} <Icon name="arrow" />
                  </span>
                </span>
                {/* halo qui respire au survol, comme dans l'aperçu de l'admin */}
                <span className="doc-card__halo" aria-hidden="true" />
                <span className="doc-card__tag">
                  <Icon name={d.kind === "pdf" ? "badge" : "edit"} />
                  {d.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {open &&
        createPortal(
          <DocViewer
            docs={docs}
            profile={profile}
            index={open.index}
            from={open.from}
            onIndex={(index) => setOpen({ index, from: null })}
            originOf={(i) => cardGeo(cards.current[i])}
            onClose={() => setOpen(null)}
          />,
          document.body
        )}
    </div>
  );
}

/* ------------------------------ la liseuse ------------------------------ */

/** Position réelle d'une carte du paquet : centre, largeur et inclinaison (pour l'envol de la feuille). */
type CardGeo = { cx: number; cy: number; w: number; angle: number };
function cardGeo(btn: HTMLElement | null | undefined): CardGeo | null {
  const sheet = btn?.querySelector<HTMLElement>(".doc-card__sheet");
  if (!btn || !sheet) return null;
  let angle = 0;
  for (const el of [btn, btn.querySelector<HTMLElement>(".doc-card__float")]) {
    const t = el ? getComputedStyle(el).transform : "none";
    if (t && t !== "none") {
      const m = new DOMMatrix(t);
      angle += Math.atan2(m.b, m.a);
    }
  }
  const r = sheet.getBoundingClientRect();
  // largeur réelle de la feuille (A4) à partir de sa boîte englobante inclinée, réductions comprises
  const a = Math.abs(angle);
  const w = r.width / (Math.cos(a) + Math.SQRT2 * Math.sin(a));
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w, angle };
}

const OPEN_MS = 720;
const EASE = "cubic-bezier(0.2, 0.85, 0.25, 1)";

function PdfPages({ url, width }: { url: string; width: number }) {
  const { t } = useSite();
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    setError(false);
    openPdf(url)
      .then((d) => alive && setDoc(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [url]);

  if (error)
    return (
      <div className="dv-error">
        <p>{t("docs.error")}</p>
        <a className="btn btn--primary" href={url} target="_blank" rel="noreferrer">
          <Icon name="external" /> {t("docs.fallback")}
        </a>
      </div>
    );
  if (!doc)
    return (
      <div className="dv-page is-wait">
        <Skeleton />
      </div>
    );
  return (
    <>
      {Array.from({ length: doc.numPages }, (_, i) => (
        <PdfPage key={i} doc={doc} n={i + 1} width={width} />
      ))}
    </>
  );
}

function PdfPage({ doc, n, width }: { doc: PdfDoc; n: number; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!ref.current || !width) return;
    let alive = true;
    drawPage(doc, n, ref.current, width).then(() => alive && setDone(true), () => {});
    return () => {
      alive = false;
    };
  }, [doc, n, width]);
  return (
    <div className={`dv-page ${done ? "is-done" : "is-wait"}`} style={{ "--n": n } as CSSProperties}>
      <canvas ref={ref} />
      {!done && <Skeleton />}
    </div>
  );
}

function DocViewer({
  docs,
  profile,
  index,
  from,
  onIndex,
  originOf,
  onClose
}: {
  docs: AppDoc[];
  profile: Profile;
  index: number;
  from: CardGeo | null;
  onIndex: (i: number) => void;
  originOf: (i: number) => CardGeo | null;
  onClose: () => void;
}) {
  const { t } = useSite();
  const doc = docs[index];
  const sheet = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [closing, setClosing] = useState(false);
  const [dir, setDir] = useState<"next" | "prev" | null>(null);
  const [width, setWidth] = useState(0);
  const first = useRef(true);

  // largeur de la feuille (les pages PDF sont dessinées à cette largeur exacte)
  useLayoutEffect(() => {
    const measure = () => setWidth(Math.min(760, (stage.current?.clientWidth ?? 760) - 32));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /**
   * La feuille s'envole depuis (ou vers) la carte : seule sa première page est visible pendant
   * le trajet (même format que la carte), avec la même inclinaison que la carte dans le paquet.
   */
  const flip = useCallback((geo: CardGeo | null, reverse: boolean) => {
    const el = sheet.current;
    if (!el || !geo || REDUCED) return null;
    el.getAnimations().forEach((a) => a.cancel());
    const s = el.getBoundingClientRect();
    const h = Math.min(s.height, s.width * Math.SQRT2);
    const k = geo.w / s.width;
    const dx = geo.cx - (s.left + s.width / 2);
    const dy = geo.cy - (s.top + h / 2);
    el.style.transformOrigin = `${s.width / 2}px ${h / 2}px`;
    const card: Keyframe = {
      transform: `translate(${dx}px, ${dy}px) rotate(${geo.angle}rad) scale(${k})`,
      clipPath: `inset(0 0 ${s.height - h}px 0 round ${12 / k}px)`,
      boxShadow: "0 10px 30px rgba(10, 40, 44, 0.18)"
    };
    const full: Keyframe = { transform: "none", clipPath: `inset(0 0 0 0 round 20px)`, boxShadow: "0 2px 4px rgba(10, 40, 44, 0.08), 0 30px 80px rgba(10, 40, 44, 0.3)" };
    const a = el.animate(reverse ? [full, card] : [card, full], {
      duration: reverse ? 560 : OPEN_MS,
      easing: reverse ? "cubic-bezier(0.4, 0, 0.2, 1)" : EASE,
      fill: "both"
    });
    if (!reverse) a.finished.then(() => (el.style.transformOrigin = ""), () => {});
    return a;
  }, []);

  useLayoutEffect(() => {
    if (!first.current) return;
    first.current = false;
    const a = flip(from, false);
    // filet de sécurité : si l'onglet passe en arrière-plan, la feuille retrouve sa place quand même
    const stop = () => a?.cancel();
    a?.finished.then(stop, () => {});
    window.setTimeout(stop, OPEN_MS + 250);
    closeBtn.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    stage.current?.scrollTo({ top: 0 });
    const a = flip(originOf(index), true);
    let done = false;
    const finish = () => {
      if (!done) (done = true), onClose();
    };
    a?.finished.then(finish, finish);
    window.setTimeout(finish, a ? 760 : 260);
  }, [closing, flip, originOf, index, onClose]);

  const go = useCallback(
    (to: number) => {
      if (to === index || to < 0 || to >= docs.length) return;
      setDir(to > index ? "next" : "prev");
      stage.current?.scrollTo({ top: 0 });
      onIndex(to);
    },
    [index, docs.length, onIndex]
  );

  // sur petit écran, l'onglet du document affiché reste visible dans la barre
  useEffect(() => {
    document.querySelector(".dv__tab.is-active")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close, go, index]);

  if (!doc) return null;
  return (
    <div
      className={`dv ${closing ? "is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={doc.title}
      style={toneStyle(doc)}
      data-edit="candidature"
      data-edit-target={`doc:${doc.id}`}
      data-edit-label="Ma candidature"
    >
      <div className="dv__backdrop" onClick={close} />

      <header className="dv__bar">
        <nav className="dv__tabs" aria-label="Documents">
          {docs.map((d, i) => (
            <button
              key={d.id || i}
              type="button"
              className={`dv__tab ${i === index ? "is-active" : ""}`}
              style={toneStyle(d)}
              onClick={() => go(i)}
              aria-current={i === index}
            >
              <i />
              {d.label}
            </button>
          ))}
        </nav>
        <div className="dv__actions">
          {doc.kind === "pdf" && doc.file && (
            <a className="btn btn--secondary btn--sm dv__download" href={doc.file} download>
              <Icon name="download" /> <span>{t("docs.download")}</span>
            </a>
          )}
          <button ref={closeBtn} type="button" className="dv__close" onClick={close} aria-label="Fermer">
            <Icon name="x" />
          </button>
        </div>
      </header>

      <div className="dv__stage" ref={stage} onClick={(e) => e.target === e.currentTarget && close()}>
        <div className="dv__intro" key={`intro-${index}`}>
          <span className="dv__label">{doc.label}</span>
          <h2 className="dv__title">{doc.title}</h2>
          {doc.caption && <p className="dv__caption">{doc.caption}</p>}
        </div>
        <div
          ref={sheet}
          key={`sheet-${index}`}
          className={`dv__sheet ${dir ? `is-${dir}` : ""} ${doc.kind === "letter" ? "dv__sheet--letter" : ""}`}
          style={{ width: width || undefined }}
        >
          {doc.kind === "pdf" ? doc.file ? <PdfPages url={doc.file} width={width} /> : null : <Letter doc={doc} profile={profile} live />}
        </div>
        {docs.length > 1 && (
          <div className="dv__pager">
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0}>
              <Icon name="left" />
              {docs[index - 1]?.label ?? ""}
            </button>
            <span>
              {index + 1} / {docs.length}
            </span>
            <button type="button" onClick={() => go(index + 1)} disabled={index === docs.length - 1}>
              {docs[index + 1]?.label ?? ""}
              <Icon name="right" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
