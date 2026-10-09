import {
  CSSProperties,
  ElementType,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent
} from "react";

/** Renvoie true dès que l'élément entre dans l'écran (une seule fois). */
export function useInView<T extends Element>(threshold = 0.2, rootMargin = "0px 0px -60px 0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);

  return { ref, inView };
}

/** Apparition au scroll : fondu + montée de 20 px (réglages Framer relevés sur byqeeps.com). */
export function Reveal({
  children,
  delay = 0,
  y = 20,
  as: Tag = "div",
  className = "",
  style,
  id,
  threshold
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  id?: string;
  /** seuil de visibilité Framer (« __framer__threshold »), sans marge ; sinon 15 % avec marge de 60 px */
  threshold?: number;
}) {
  const { ref, inView } = useInView<HTMLElement>(threshold ?? 0.15, threshold !== undefined ? "0px" : "0px 0px -60px 0px");
  return (
    <Tag
      ref={ref}
      id={id}
      className={`reveal ${inView ? "is-in" : ""} ${className}`}
      style={{ ...style, "--delay": `${delay}ms`, "--reveal-y": `${y}px` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

/**
 * Défilement horizontal infini à vitesse constante (px/s), comme les "Ticker" Framer.
 * Piloté en requestAnimationFrame : la position ne saute jamais quand la largeur change
 * (chargement des images ou des polices). Au survol, il continue au ralenti :
 * mesuré sur byqeeps.com, 25 px/s → 5 px/s, soit 20 % de la vitesse, sans transition.
 */
export function Marquee({
  children,
  speed = 25,
  hoverFactor = 0.2,
  fade = 15,
  className = ""
}: {
  children: ReactNode;
  /** vitesse en pixels par seconde */
  speed?: number;
  /** part de la vitesse conservée au survol (Framer : 0,2) */
  hoverFactor?: number;
  /** largeur du fondu sur chaque bord, en % */
  fade?: number;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const hovered = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let last = performance.now();
    let offset = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const current = hovered.current ? speed * hoverFactor : speed;
      const width = groupRef.current?.offsetWidth ?? 0;
      if (width > 0) {
        offset = (offset + current * dt) % width;
        if (trackRef.current) trackRef.current.style.transform = `translate3d(${-offset}px, 0, 0)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [speed, hoverFactor]);

  return (
    <div
      className={`marquee ${className}`}
      style={{ "--fade": `${fade}%` } as CSSProperties}
      onMouseEnter={() => (hovered.current = true)}
      onMouseLeave={() => (hovered.current = false)}
    >
      <div className="marquee__track" ref={trackRef}>
        <div className="marquee__group" ref={groupRef}>{children}</div>
        <div className="marquee__group" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Compteur animé qui démarre quand il devient visible. */
export function CountUp({
  value,
  prefix = "",
  suffix = "",
  duration = 1600
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.5);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCurrent(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setCurrent(Math.round(eased * value));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {current}
      {suffix}
    </span>
  );
}

/**
 * Inclinaison 3D qui suit la souris, lissée image par image (effet "ressort").
 * Amplitude calée sur la carte « Certifié » de byqeeps.com : ~10° vertical, ~5° horizontal,
 * perspective 1200 px, échelle 1,01. `base` permet de garder une rotation de repos.
 */
export function useTilt<T extends HTMLElement>({
  maxX = 10,
  maxY = 7,
  scale = 1.01,
  base = ""
}: { maxX?: number; maxY?: number; scale?: number; base?: string } = {}) {
  const ref = useRef<T>(null);
  const target = useRef({ rx: 0, ry: 0, s: 1, gx: 50, gy: 50, glare: 0 });
  const current = useRef({ rx: 0, ry: 0, s: 1, gx: 50, gy: 50, glare: 0 });
  const frame = useRef(0);
  const last = useRef(0);

  const render = useCallback((now: number) => {
    const el = ref.current;
    if (!el) return;
    const c = current.current;
    const t = target.current;
    // interpolation indépendante du nombre d'images/s (constante de temps ≈ 110 ms)
    const dt = Math.min(64, last.current ? now - last.current : 16);
    last.current = now;
    const k = 1 - Math.exp(-dt / 110);
    let moving = false;
    (Object.keys(c) as (keyof typeof c)[]).forEach((key) => {
      const d = t[key] - c[key];
      if (Math.abs(d) > 0.001) moving = true;
      c[key] += d * k;
    });
    el.style.transform = `${base} perspective(1200px) rotateX(${c.rx.toFixed(3)}deg) rotateY(${c.ry.toFixed(3)}deg) scale(${c.s.toFixed(4)})`;
    el.style.setProperty("--glare-x", `${c.gx.toFixed(1)}%`);
    el.style.setProperty("--glare-y", `${c.gy.toFixed(1)}%`);
    el.style.setProperty("--glare-o", c.glare.toFixed(3));
    frame.current = moving ? requestAnimationFrame(render) : 0;
    if (!moving) last.current = 0;
  }, [base]);

  const kick = useCallback(() => {
    if (!frame.current) {
      last.current = 0;
      frame.current = requestAnimationFrame(render);
    }
  }, [render]);

  useEffect(() => {
    if (ref.current) ref.current.style.transform = `${base} perspective(1200px)`;
    return () => cancelAnimationFrame(frame.current);
  }, [base]);

  const onMouseMove = useCallback(
    (e: MouseEvent<T>) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const r = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width; // 0 → 1
      const y = (e.clientY - r.top) / r.height;
      // la carte "s'enfonce" sous le curseur : haut → bascule vers l'arrière
      target.current = {
        rx: (0.5 - y) * 2 * maxX,
        ry: (x - 0.5) * 2 * maxY,
        s: scale,
        gx: x * 100,
        gy: y * 100,
        glare: 1
      };
      kick();
    },
    [maxX, maxY, scale, kick]
  );

  const onMouseLeave = useCallback(() => {
    target.current = { ...target.current, rx: 0, ry: 0, s: 1, glare: 0 };
    kick();
  }, [kick]);

  return { ref, onMouseMove, onMouseLeave };
}

/** Carte qui s'incline en 3D en suivant la souris. */
export function Tilt({ children, className = "" }: { children: ReactNode; className?: string }) {
  const tilt = useTilt<HTMLDivElement>();
  return (
    <div ref={tilt.ref} className={`tilt ${className}`} onMouseMove={tilt.onMouseMove} onMouseLeave={tilt.onMouseLeave}>
      {children}
      <span className="tilt-glare" aria-hidden="true" />
    </div>
  );
}

/** Index qui avance tout seul (pour faire tourner un élément mis en avant). */
export function useCycle(length: number, interval = 2600) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % length), interval);
    return () => clearInterval(id);
  }, [length, interval]);
  return index;
}
