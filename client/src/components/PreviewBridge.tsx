import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useContact } from "./ContactModal";
import { useSiteModals } from "./SiteModals";

/**
 * Pont entre le site affiché dans l'aperçu et l'admin (uniquement dans l'iframe
 * /?apercu=1) :
 * - aller là où l'on écrit : défiler, ouvrir une fenêtre, afficher un poste ou un projet,
 *   puis le mettre en lumière (même onde que « Voir cette expérience » sur le site) ;
 * - au survol, une partie modifiable s'éclaire doucement ; un clic ouvre sa section dans l'admin.
 *
 * Cibles : "top", "#id", "nav", "footer", "modal:contact|about|login",
 * "xp:<id du poste>", "project:<slug>".
 * Les halos sont dessinés dans un calque à part : ils n'interfèrent jamais avec le site.
 */
const IN_PREVIEW = typeof window !== "undefined" && window.parent !== window && new URLSearchParams(location.search).has("apercu");

const NAV_OFFSET = 84;

/** Teinte de chaque partie du site : la même que sa section dans l'admin. */
const TONES: Record<string, { fg: string; bg: string }> = {
  cyan: { fg: "#176c79", bg: "#ddf7f7" },
  green: { fg: "#2f7d55", bg: "#d1ede0" },
  pink: { fg: "#a4475f", bg: "#f3dde2" },
  sand: { fg: "#94681f", bg: "#f6e9d3" }
};
const SECTION_TONE: Record<string, keyof typeof TONES> = {
  accueil: "cyan",
  stack: "green",
  profil: "pink",
  experiences: "sand",
  methode: "cyan",
  chiffres: "green",
  projets: "pink",
  formation: "sand",
  atouts: "cyan",
  candidature: "pink",
  contact: "green",
  apropos: "pink",
  textes: "sand"
};
const toneOf = (el: HTMLElement | null) => TONES[SECTION_TONE[el?.dataset.edit ?? ""] ?? "cyan"];

type Box = { top: number; left: number; width: number; height: number; radius: number; fixed: boolean };

/** facteur qui compense la réduction de l'aperçu (épaisseurs et arrondis lisibles) */
const ps = () => Number(getComputedStyle(document.documentElement).getPropertyValue("--ps")) || 1;

/** Contour à dessiner pour un élément : son arrondi, ou une carte un peu plus large s'il n'en a pas. */
function boxOf(target: HTMLElement): Box {
  // un conteneur qui n'enveloppe qu'un seul bloc (ex. la carte des expériences) : on prend le bloc
  let el = target;
  while (!el.matches("section, header, footer, .nav") && el.children.length === 1 && el.firstElementChild instanceof HTMLElement) {
    el = el.firstElementChild;
  }
  let r: { top: number; left: number; width: number; height: number } = el.getBoundingClientRect();
  // bloc pleine largeur qui n'est pas une section (défilé, grille…) : on épouse son contenu réel
  if (r.width >= window.innerWidth - 4 && !el.matches("section, header, footer, .nav") && el.children.length) {
    const rs = [...el.children].map((c) => c.getBoundingClientRect()).filter((c) => c.width && c.height);
    if (rs.length) {
      const t = Math.min(...rs.map((c) => c.top));
      const l = Math.max(0, Math.min(...rs.map((c) => c.left)));
      const b = Math.max(...rs.map((c) => c.bottom));
      const rr = Math.min(window.innerWidth, Math.max(...rs.map((c) => c.right)));
      r = { top: t, left: l, width: rr - l, height: b - t };
    }
  }
  const k = ps();
  const cs = getComputedStyle(el);
  const fixed = cs.position === "fixed" || cs.position === "sticky" || !!el.closest(".modal");
  const radius = parseFloat(cs.borderTopLeftRadius) || 0;
  let { top, left, width, height } = r;
  if (width >= window.innerWidth - 4) {
    // section pleine largeur : une carte légèrement en retrait des bords
    left += 14 * k;
    width -= 28 * k;
    top += 6 * k;
    height -= 12 * k;
  } else if (!radius) {
    // bloc de texte : un peu d'air autour
    const pad = 14 * k;
    top -= pad;
    left -= pad;
    width += pad * 2;
    height += pad * 2;
  }
  return {
    top: fixed ? top : top + window.scrollY,
    left: fixed ? left : left + window.scrollX,
    width,
    height,
    radius: radius || 20 * k,
    fixed
  };
}

/**
 * Défilement doux piloté en JS. Safari ignore `scroll-behavior: smooth` dans une iframe réduite
 * et peut aussi suspendre `requestAnimationFrame` dans un cadre transformé : chaque image est donc
 * demandée à la fois par rAF et par un minuteur (le premier arrivé l'emporte), et la position
 * finale est toujours appliquée, même si l'animation n'a pas pu tourner.
 */
const scroller = () => (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
const currentY = () => window.scrollY || scroller().scrollTop || 0;
function setY(y: number) {
  window.scrollTo(0, y);
  // filet de sécurité : certains WebKit n'appliquent pas window.scrollTo dans une iframe
  if (Math.abs(currentY() - y) > 1) scroller().scrollTop = y;
}

let scrollRun = 0;
function smoothScroll(to: number) {
  const run = ++scrollRun;
  const max = Math.max(0, scroller().scrollHeight - window.innerHeight);
  const target = Math.min(max, Math.max(0, to));
  const from = currentY();
  const dist = target - from;
  if (Math.abs(dist) < 1) return;
  const duration = Math.min(900, 380 + Math.abs(dist) * 0.12);
  const t0 = performance.now();
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  let raf = 0;
  let timer = 0;
  const schedule = () => {
    raf = requestAnimationFrame(step);
    timer = window.setTimeout(step, 20);
  };
  function step() {
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
    if (run !== scrollRun) return; // un autre défilement a pris le relais
    const t = Math.min(1, (performance.now() - t0) / duration);
    setY(from + dist * ease(t));
    if (t < 1) schedule();
  }
  schedule();
  // quoi qu'il arrive, on finit au bon endroit
  window.setTimeout(() => run === scrollRun && setY(target), duration + 120);
}

function scrollToEl(el: Element | null, block: "start" | "center" = "start") {
  if (!el) return smoothScroll(0);
  const r = el.getBoundingClientRect();
  const top =
    block === "center" && r.height < window.innerHeight - NAV_OFFSET
      ? r.top + currentY() - (window.innerHeight - r.height) / 2
      : r.top + currentY() - NAV_OFFSET;
  smoothScroll(top);
}

/** Attend qu'un élément existe (sections rendues après le chargement des données). */
function whenReady(id: string, cb: (el: HTMLElement | null) => void, tries = 40) {
  const el = document.getElementById(id);
  if (el || tries <= 0) return cb(el);
  window.setTimeout(() => whenReady(id, cb, tries - 1), 120);
}

/** Demande une mise en lumière (le calque la dessine une fois le défilement lancé). */
function spotlight(el: Element | null) {
  if (el) window.dispatchEvent(new CustomEvent("pv:spotlight", { detail: el }));
}

const boxStyle = (b: Box): CSSProperties => ({
  position: b.fixed ? "fixed" : "absolute",
  top: b.top,
  left: b.left,
  width: b.width,
  height: b.height,
  borderRadius: b.radius
});

export default function PreviewBridge() {
  const contact = useContact();
  const modals = useSiteModals();
  const ctl = useRef({ contact, modals });
  ctl.current = { contact, modals };
  const [hover, setHover] = useState<Box | null>(null);
  const [hoverTone, setHoverTone] = useState(TONES.cyan);
  const [spot, setSpot] = useState<{ key: number; box: Box } | null>(null);
  const hoverEl = useRef<HTMLElement | null>(null);
  const lastHover = useRef<Box | null>(null);
  if (hover) lastHover.current = hover;

  // aller vers la cible demandée par l'admin
  useEffect(() => {
    if (!IN_PREVIEW) return;
    document.documentElement.classList.add("is-preview");
    // le défilement est animé en JS : aucun défilement doux natif ne doit s'y superposer (Safari)
    document.documentElement.style.scrollBehavior = "auto";
    const go = (target: string) => {
      const { contact, modals } = ctl.current;
      const isModal = target.startsWith("modal:");
      if (!isModal || target !== "modal:contact") contact.close();
      if (!isModal || target === "modal:contact") modals.show(null);
      const later = (fn: () => void) => window.setTimeout(fn, 60);
      // la liseuse des documents ne reste ouverte que pour un document
      if (!target.startsWith("doc:")) window.dispatchEvent(new CustomEvent("doc:close"));

      if (target === "modal:contact") {
        contact.open();
        return later(() => spotlight(document.querySelector(".modal__panel")));
      }
      if (target === "modal:about" || target === "modal:login") {
        modals.show(target === "modal:about" ? "about" : "login");
        return later(() => spotlight(document.querySelector(".modal__panel")));
      }
      if (target === "top") return smoothScroll(0);
      if (target === "nav") {
        smoothScroll(0);
        return spotlight(document.querySelector(".nav"));
      }
      if (target === "footer") {
        const el = document.getElementById("footer");
        if (el) smoothScroll(el.getBoundingClientRect().bottom + currentY() - window.innerHeight);
        return spotlight(el);
      }
      if (target.startsWith("xp:")) {
        return whenReady("parcours", (el) => {
          window.dispatchEvent(new CustomEvent("xp:show", { detail: target.slice(3) }));
          const card = el?.querySelector<HTMLElement>(".xps") ?? el;
          scrollToEl(card);
          spotlight(card);
        });
      }
      if (target.startsWith("project:")) {
        return whenReady("projets", (el) => {
          window.dispatchEvent(new CustomEvent("project:show", { detail: target.slice(8) }));
          const card = el?.querySelector<HTMLElement>(".pswitch, .pstage") ?? el;
          scrollToEl(card);
          spotlight(card);
        });
      }
      if (target.startsWith("doc:")) {
        // un document de « Ma candidature » : on descend au bloc, puis la feuille s'ouvre depuis sa carte
        return whenReady("candidature", (el) => {
          const block = el?.closest<HTMLElement>(".feature") ?? el;
          scrollToEl(block, "center");
          window.setTimeout(() => window.dispatchEvent(new CustomEvent("doc:open", { detail: target.slice(4) })), 650);
        });
      }
      if (target.startsWith("#edu-")) {
        // une formation : sa carte passe devant dans la pile, on montre tout le bloc
        return whenReady(target.slice(1), (el) => {
          window.dispatchEvent(new CustomEvent("edu:show", { detail: target.slice(5) }));
          const block = el?.closest<HTMLElement>(".feature") ?? el;
          scrollToEl(block, "center");
          spotlight(block);
        });
      }
      if (target.startsWith("#")) {
        return whenReady(target.slice(1), (el) => {
          const isSection = el?.tagName === "SECTION";
          // un élément placé dans un grand bloc gris (ex. « Ma candidature ») : tout le bloc
          const block = isSection ? el : el?.closest<HTMLElement>(".feature") ?? el;
          scrollToEl(block, isSection ? "start" : "center");
          // une section : toute la section, comme un clic dans l'aperçu
          spotlight(block);
        });
      }
    };
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      if (e.data?.type === "qeeps:ping") window.parent.postMessage({ type: "qeeps:ready" }, location.origin);
      if (e.data?.type === "qeeps:goto") {
        if (e.data.tone?.fg) {
          document.documentElement.style.setProperty("--pf-fg", e.data.tone.fg);
          document.documentElement.style.setProperty("--pf-bg", e.data.tone.bg);
        }
        go(String(e.data.target ?? e.data.anchor ?? "top"));
      }
      if (e.data?.type === "qeeps:scale") document.documentElement.style.setProperty("--ps", String(1 / Math.max(0.2, Number(e.data.scale) || 1)));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // mise en lumière : l'onde part une fois que la page a commencé à défiler
  useEffect(() => {
    if (!IN_PREVIEW) return;
    let t = 0;
    const onSpot = (e: Event) => {
      const el = (e as CustomEvent<HTMLElement>).detail;
      window.clearTimeout(t);
      t = window.setTimeout(() => setSpot({ key: Date.now(), box: boxOf(el) }), 450);
    };
    window.addEventListener("pv:spotlight", onSpot);
    return () => {
      window.removeEventListener("pv:spotlight", onSpot);
      window.clearTimeout(t);
    };
  }, []);

  // survol : la partie modifiable s'éclaire ; un clic ouvre sa section dans l'admin
  useEffect(() => {
    if (!IN_PREVIEW) return;
    let raf = 0;
    const update = (target: EventTarget | null) => {
      const el = (target as HTMLElement | null)?.closest?.<HTMLElement>("[data-edit]") ?? null;
      if (el !== hoverEl.current && el) setHoverTone(toneOf(el));
      hoverEl.current = el;
      setHover(el ? boxOf(el) : null);
    };
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => update(e.target));
    };
    const onLeave = () => update(null);
    const refresh = () => hoverEl.current && setHover(boxOf(hoverEl.current));
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest?.<HTMLElement>("[data-edit]");
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const tone = toneOf(el);
      document.documentElement.style.setProperty("--pf-fg", tone.fg);
      document.documentElement.style.setProperty("--pf-bg", tone.bg);
      window.parent.postMessage({ type: "qeeps:pick", section: el.dataset.edit, target: el.dataset.editTarget }, location.origin);
      spotlight(el);
    };
    document.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!IN_PREVIEW) return null;
  return createPortal(
    <>
      <span
        className={`pv-hover ${hover ? "is-on" : ""}`}
        style={
          lastHover.current
            ? ({ ...boxStyle(lastHover.current), "--hv-fg": hoverTone.fg, "--hv-bg": hoverTone.bg } as CSSProperties)
            : { display: "none" }
        }
        aria-hidden="true"
      />
      {spot && <span key={spot.key} className="pv-spot" style={boxStyle(spot.box)} aria-hidden="true" onAnimationEnd={() => setSpot(null)} />}
    </>,
    document.body
  );
}
