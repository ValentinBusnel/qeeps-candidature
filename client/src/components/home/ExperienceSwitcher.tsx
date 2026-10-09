import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Experience } from "../../api";
import { Icon } from "../Icons";
import { useSite } from "../../content";
import { stackLogo } from "../../lib/stackLogos";
import "./experience.css";

/* ---------- Dates : « Oct. 2023 – Fév. 2026 » → mois absolus ---------- */
const MONTHS: Record<string, number> = {
  janv: 0, jan: 0, fevr: 1, fev: 1, feb: 1, mars: 2, mar: 2, avr: 3, apr: 3, mai: 4, may: 4, juin: 5, jun: 5,
  juil: 6, jul: 6, aout: 7, aug: 7, sept: 8, sep: 8, oct: 9, nov: 10, dec: 11
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function parsePeriod(period: string): [number, number] | null {
  const found = [...norm(period).matchAll(/([a-z]+)\.?\s*(\d{4})/g)].map((m) => {
    const key = Object.keys(MONTHS).find((k) => m[1].startsWith(k));
    return Number(m[2]) * 12 + (key ? MONTHS[key] : 0);
  });
  if (!found.length) return null;
  const now = new Date();
  const end = found[1] ?? (/(aujourd|present|actuel)/.test(norm(period)) ? now.getFullYear() * 12 + now.getMonth() : found[0]);
  return [found[0], end];
}
function duration(months: number) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return { y, m, text: [y ? `${y} an${y > 1 ? "s" : ""}` : "", m ? `${m} mois` : ""].filter(Boolean).join(" ") };
}
const initials = (company: string) => company.replace(/^Groupe /, "").slice(0, 2).toUpperCase();
/** Logos par défaut (dans client/public/logos) ; un logo saisi dans l'admin est prioritaire. */
const logoOf = (xp: Experience) => xp.logoUrl;

/** Logo de l'entreprise, ou ses initiales s'il n'y en a pas. */
function Mark({ xp }: { xp: Experience }) {
  const src = logoOf(xp);
  const [failed, setFailed] = useState(false);
  return src && !failed ? <img src={src} alt="" draggable={false} onError={() => setFailed(true)} /> : <span>{initials(xp.company)}</span>;
}

/** Compteur qui roule de l'ancienne valeur vers la nouvelle. */
function Rolling({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const v = Math.round(a + (value - a) * (1 - Math.pow(1 - t, 3)));
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
}

function Tech({ name, i }: { name: string; i: number }) {
  const src = stackLogo(name);
  const [failed, setFailed] = useState(false);
  return (
    <span className="xps__tech" title={name} style={{ "--i": i } as CSSProperties}>
      {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : null}
      <span>{name}</span>
    </span>
  );
}

/**
 * Expériences : une frise chronologique qu'on peut « scrubber » à la souris ou au doigt.
 * Chaque poste est un segment placé à ses vraies dates ; la tête de lecture glisse dessus,
 * la fiche se retourne (logo en 3D), la durée roule, les missions arrivent en cascade.
 */
export default function ExperienceSwitcher({ experiences }: { experiences: Experience[] }) {
  const { t } = useSite();
  // chronologique sur la frise (le plus ancien à gauche), la plus récente sélectionnée au départ
  const items = useMemo(() => {
    return experiences
      .map((xp) => ({ xp, range: parsePeriod(xp.period) }))
      .sort((a, b) => (a.range?.[0] ?? 0) - (b.range?.[0] ?? 0));
  }, [experiences]);
  const [index, setIndex] = useState(Math.max(0, items.length - 1));
  const [dir, setDir] = useState<1 | -1>(1);
  const [group, setGroup] = useState(0);
  const [turn, setTurn] = useState(0);
  const [drag, setDrag] = useState<number | null>(null); // position libre de la tête de lecture (%), pendant le glisser
  const railRef = useRef<HTMLDivElement>(null);
  const groupsRef = useRef<HTMLDivElement>(null);
  const [groupInd, setGroupInd] = useState<CSSProperties>({ opacity: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  // frise : un poste par case, côte à côte, du plus ancien au plus récent
  const geom = useMemo(() => items.map((_, i) => ({ left: (i * 100) / items.length, w: 100 / items.length })), [items]);

  const select = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(items.length - 1, next));
      if (target === index) return;
      setDir(target > index ? 1 : -1);
      setIndex(target);
      setGroup(0);
      setTurn((t) => t + 1);
    },
    [index, items.length]
  );

  /* Pastille blanche des onglets de missions : elle glisse sous l'onglet choisi. */
  useLayoutEffect(() => {
    const box = groupsRef.current;
    const tab = box?.querySelectorAll<HTMLButtonElement>(".xps__group-tab")[group];
    if (!box || !tab) return setGroupInd({ opacity: 0 });
    setGroupInd({ transform: `translateX(${tab.offsetLeft}px)`, width: tab.offsetWidth, opacity: 1 });
  }, [group, index]);

  /* Lien depuis la carte « Fiches » plus haut : on affiche l'expérience demandée. */
  useEffect(() => {
    const onShow = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const i = items.findIndex((it) => it.xp.id === id);
      if (i >= 0) select(i);
    };
    window.addEventListener("xp:show", onShow);
    return () => window.removeEventListener("xp:show", onShow);
  }, [items, select]);

  /* ---- Glisser sur la frise : la pastille blanche suit le doigt et choisit le poste dessous ---- */
  const pickAt = (clientX: number) => {
    const r = railRef.current!.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * 100;
    setDrag(p);
    const i = geom.findIndex((g) => p >= g.left && p <= g.left + g.w);
    select(i === -1 ? (p < 50 ? 0 : items.length - 1) : i);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pickAt(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag !== null) pickAt(e.clientX);
  };
  const endDrag = () => setDrag(null);

  if (!items.length) return null;
  const { xp, range } = items[index];
  const months = range ? range[1] - range[0] + 1 : 0;
  const d = duration(months);
  const g = geom[index];
  // pendant le glisser, la pastille est centrée sous le doigt (sans sortir de la frise)
  const indLeft = drag === null ? g.left : Math.min(100 - g.w, Math.max(0, drag - g.w / 2));
  const currentGroup = xp.groups[Math.min(group, xp.groups.length - 1)];
  const maxMonths = Math.max(1, ...items.map((it) => (it.range ? it.range[1] - it.range[0] + 1 : 0)));

  return (
    <div
      className="xps"
      ref={rootRef}
      id="experiences"
      style={{ "--dir": dir } as CSSProperties}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") select(index + 1);
        if (e.key === "ArrowLeft") select(index - 1);
      }}
    >
      {/* ---- Frise ---- */}
      <div className="xps__timeline">
        <div
          className={`xps__rail ${drag !== null ? "is-dragging" : ""}`}
          ref={railRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="tablist"
          aria-label="Expériences"
        >
          {/* pastille blanche « liquide » derrière le poste affiché */}
          <span
            className="xps__ind"
            style={{
              left: `${indLeft}%`,
              right: `${100 - indLeft - g.w}%`,
              transition:
                drag !== null
                  ? "none"
                  : dir === 1
                    ? "right 0.38s cubic-bezier(0.3, 0.7, 0.2, 1), left 0.62s 0.07s cubic-bezier(0.3, 0.7, 0.2, 1)"
                    : "left 0.38s cubic-bezier(0.3, 0.7, 0.2, 1), right 0.62s 0.07s cubic-bezier(0.3, 0.7, 0.2, 1)"
            }}
            aria-hidden="true"
          />
          {items.map((it, i) => (
            <button
              key={it.xp.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`xps__seg ${i === index ? "is-active" : ""} ${i < index ? "is-past" : ""}`}
              style={{ left: `${geom[i].left}%`, width: `${geom[i].w}%` }}
              onClick={() => select(i)}
            >
              <span className={`xps__seg-logo ${logoOf(it.xp) ? "has-img" : ""}`}>
                <Mark xp={it.xp} />
              </span>
              <span className="xps__seg-text">
                <strong>{it.xp.company}</strong>
                <small>{it.xp.period}</small>
              </span>
              <span className="xps__seg-num">{String(i + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ---- Fiche : une seule carte blanche dans le bloc gris ---- */}
      <div className="xps__card">
        <div key={`id-${turn}`} className="xps__sheet">
          <header className="xps__top">
            <span className={`xps__logo ${logoOf(xp) ? "has-img" : ""}`}>
              <Mark xp={xp} />
            </span>
            <div className="xps__who xps__in" style={{ "--k": 0 } as CSSProperties}>
              <h3>{xp.company}</h3>
              <p>{xp.role}</p>
              <div className="xps__tags">
                <span className="tag"><Icon name="briefcase" /> {xp.contract}</span>
                <span className="tag"><Icon name="clock" /> {xp.period}</span>
                <span className="tag"><Icon name="pin" /> {xp.mode}</span>
              </div>
            </div>
            {months > 0 && (
              <div className="xps__duration xps__in" style={{ "--k": 1 } as CSSProperties}>
                <span className="xps__duration-value t-gradient">
                  {d.y > 0 && (
                    <>
                      <Rolling value={d.y} /> <small>{d.y > 1 ? t("xp.years") : t("xp.year")}</small>{" "}
                    </>
                  )}
                  {d.m > 0 && (
                    <>
                      <Rolling value={d.m} /> <small>{t("xp.months")}</small>
                    </>
                  )}
                </span>
                <span className="xps__duration-label">{t("xp.inPost")}</span>
                {/* part du parcours : la barre se remplit à chaque changement de poste */}
                <span className="xps__bar" aria-hidden="true">
                  <span style={{ "--w": `${(months / maxMonths) * 100}%` } as CSSProperties} />
                </span>
              </div>
            )}
          </header>

          <div className="xps__body">
            <div className="xps__aside">
              <p className="xps__label xps__in" style={{ "--k": 2 } as CSSProperties}>{t("xp.summary")}</p>
              <p className="xps__summary xps__in" style={{ "--k": 2 } as CSSProperties}>
                {xp.summary}
              </p>
              <p className="xps__label xps__in" style={{ "--k": 3 } as CSSProperties}>{t("xp.env")}</p>
              <div className="xps__env">
                {xp.env.map((e, i) => (
                  <Tech key={e} name={e} i={i} />
                ))}
              </div>
            </div>

            <div className="xps__missions">
              {xp.groups.length > 1 ? (
                <div className="xps__groups" role="tablist" aria-label="Types de missions" ref={groupsRef}>
                  <span className="xps__groups-ind" style={groupInd} aria-hidden="true" />
                  {xp.groups.map((g, i) => (
                    <button
                      key={g.title}
                      type="button"
                      role="tab"
                      aria-selected={i === group}
                      className={`xps__group-tab ${i === group ? "is-active" : ""}`}
                      onClick={() => setGroup(i)}
                    >
                      {g.title.split(/\s[—–-]\s/)[0]}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="xps__label">{currentGroup.title}</p>
              )}
              <ul key={`${turn}-${group}`} className="xps__bullets">
                {currentGroup.bullets.map((b, i) => (
                  <li key={b} style={{ "--k": i } as CSSProperties}>
                    <span className="xps__bullet-dot" aria-hidden="true">
                      <Icon name="check" />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
