import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Profile } from "../api";
import { Icon } from "../components/Icons";

/**
 * Aperçu en direct : le vrai site dans une fenêtre de navigateur miniature.
 * Il reçoit le brouillon à chaque frappe (postMessage, même origine) et se place
 * tout seul sur la section en cours de modification.
 */
/** mêmes teintes que l'admin (admin.css, .adm-tone--…) */
const TONES = {
  cyan: { fg: "#176c79", bg: "#ddf7f7" },
  green: { fg: "#2f7d55", bg: "#d1ede0" },
  pink: { fg: "#a4475f", bg: "#f3dde2" },
  sand: { fg: "#94681f", bg: "#f6e9d3" }
};

export default function LivePreview({
  draft,
  target,
  label,
  tone = "cyan",
  onPick
}: {
  /** teinte de la section (halo et bouton « Modifier » dans l'aperçu) */
  tone?: "cyan" | "green" | "pink" | "sand";
  draft: Profile | null;
  /** endroit à montrer : "top", "#id", "nav", "footer", "modal:…", "xp:…" */
  target: string;
  label: string;
  /** clic sur « Modifier » dans l'aperçu */
  onPick?: (section: string, target?: string) => void;
}) {
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [size, setSize] = useState({ w: 0 });

  const width = device === "desktop" ? 1280 : 390;
  const scale = size.w ? Math.min(1, (size.w - (device === "mobile" ? 48 : 0)) / width) : 0.4;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.getBoundingClientRect().width });
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // le site prévient quand il est prêt à recevoir le brouillon
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "qeeps:ready") {
        setReady(true);
        setTick((t) => t + 1); // à chaque « prêt », on renvoie le brouillon et l'endroit
      }
      if (e.data?.type === "qeeps:pick" && e.data.section) pickRef.current?.(String(e.data.section), e.data.target ? String(e.data.target) : undefined);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const post = (msg: unknown) => frame.current?.contentWindow?.postMessage(msg, location.origin);

  // poignée de main : tant que l'aperçu n'a pas répondu, on le relance (rechargement,
  // mise à jour du code, changement de format…) pour ne jamais rester « débranché »
  useEffect(() => {
    if (ready) return;
    const id = setInterval(() => post({ type: "qeeps:ping" }), 400);
    return () => clearInterval(id);
  }, [ready, device]);

  useEffect(() => {
    if (!ready || !draft) return;
    const t = setTimeout(() => post({ type: "qeeps:draft", profile: draft }), 120);
    return () => clearTimeout(t);
  }, [draft, ready, tick]);

  // l'aperçu suit l'endroit où l'on travaille (petit délai : on laisse le brouillon arriver d'abord)
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => post({ type: "qeeps:goto", target, tone: TONES[tone] }), 160);
    return () => clearTimeout(t);
  }, [target, ready, device, tick, tone]);

  // taille du bouton « Modifier » et des halos, compensée selon la réduction
  useEffect(() => {
    if (ready) post({ type: "qeeps:scale", scale });
  }, [ready, scale, tick]);

  return (
    <div className={`adm-preview adm-preview--${device}`}>
      <div className="adm-preview__bar">
        <span className="adm-preview__live">
          <span className="adm-pulse" /> Aperçu en direct
        </span>
        <span key={label} className="adm-preview__where">{label}</span>
        <div className="adm-preview__devices" role="group" aria-label="Format d'aperçu">
          <button type="button" className={device === "desktop" ? "is-active" : ""} onClick={() => { setReady(false); setDevice("desktop"); }} aria-label="Ordinateur" title="Ordinateur">
            <Icon name="desktop" />
          </button>
          <button type="button" className={device === "mobile" ? "is-active" : ""} onClick={() => { setReady(false); setDevice("mobile"); }} aria-label="Mobile" title="Mobile">
            <Icon name="phone-device" />
          </button>
        </div>
      </div>
      <div className="adm-preview__stage" ref={box}>
        <div
          className="adm-preview__screen"
          style={{ width: width * scale, height: device === "mobile" ? `min(calc(100% - 32px), ${Math.round(844 * scale)}px)` : "100%" }}
        >
          <iframe
            key={device}
            ref={frame}
            src="/?apercu=1"
            onLoad={() => setReady(false)}
            title="Aperçu du site"
            style={{ width, height: `${100 / scale}%`, transform: `scale(${scale})` }}
          />
          {!ready && <span className="adm-preview__loading" />}
        </div>
      </div>
    </div>
  );
}
