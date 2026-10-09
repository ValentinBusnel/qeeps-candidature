import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import type { Profile, Sections } from "../../api";
import { rich } from "../../lib/rich";
import CandidateCard, { type CandidateRow } from "../CandidateCard";
import { Icon, type IconName } from "../Icons";
import { useSite } from "../../content";
import { DocsVisual } from "./Documents";

/**
 * Les 4 blocs « Comment ça fonctionne ? » de byqeeps.com : 828 × 310 px, rayon 24,
 * marges 24/48. Le visuel est statique et s'anime au survol du bloc, comme sur le site.
 */
function FeatureBlock({
  id,
  title,
  text,
  visual,
  reverse = false,
  variant,
  edit
}: {
  id?: string;
  title: string;
  text: string;
  /** élément, ou fonction recevant l'état de survol du bloc (animations pilotées en JS) */
  visual: ReactNode | ((hovered: boolean) => ReactNode);
  reverse?: boolean;
  variant: "mails" | "tiles" | "people" | "cert" | "docs";
  /** bloc géré par sa propre section de l'admin (clic dans l'aperçu) */
  edit?: { id: string; label: string };
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      id={id}
      className={`feature feature--${variant} ${reverse ? "feature--reverse" : ""}`}
      data-edit={edit?.id}
      data-edit-label={edit?.label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="feature__text">
        <h3 className="t-h3">{title}</h3>
        <p className="t-lead">{rich(text)}</p>
      </div>
      <div className="feature__visual">{typeof visual === "function" ? visual(hovered) : visual}</div>
    </div>
  );
}

type Features = Sections["features"];

/* ---------- 1. Pile de mails ---------- */
/** Badge de catégorie : couleur et pictogramme déduits du libellé saisi dans l'admin. */
const BADGE_TONES: { test: RegExp; tone: string; icon?: IconName }[] = [
  { test: /prod|incident|urgent|bug/i, tone: "red" },
  { test: /flux|data|etl|talend|import/i, tone: "amber", icon: "database" },
  { test: /évol|evol|feature|demande|sprint/i, tone: "blue", icon: "rocket" },
  { test: /report|power ?bi|kpi|dashboard|chiffre/i, tone: "violet", icon: "chart" },
  { test: /support|merci|résolu|resolu/i, tone: "green", icon: "check" }
];

function MailBadge({ label }: { label: string }) {
  const match = BADGE_TONES.find((b) => b.test.test(label));
  const tone = match?.tone ?? "teal";
  return (
    <span className={`mail__source mail__source--${tone}`}>
      {match?.icon ? <Icon name={match.icon} /> : <span className="mail__pulse" aria-hidden="true" />}
      {label}
    </span>
  );
}

function MailCard({ m, withButton }: { m: Features["messages"][number]; withButton?: boolean }) {
  const { t } = useSite();
  return (
    <div className="mail">
      <div className="mail__head">
        <span className="mail__app">
          <span className="mail__icon">
            <Icon name="mail" />
          </span>
          {t("ill.mail")}
        </span>
        <MailBadge label={m.source} />
      </div>
      <p className="mail__from">{m.from}</p>
      <p className="mail__text">{m.text}</p>
      {withButton && <span className="mail__btn">{t("ill.reply")}</span>}
    </div>
  );
}

function MailsVisual({ messages }: { messages: Features["messages"] }) {
  if (!messages.length) return null;
  const at = (i: number) => messages[i % messages.length];
  return (
    <div className="mails">
      <div className="mails__slot mails__slot--top"><MailCard m={at(1)} /></div>
      <div className="mails__slot mails__slot--main"><MailCard m={at(0)} withButton /></div>
      <div className="mails__slot mails__slot--bottom"><MailCard m={at(2)} /></div>
      <div className="mails__slot mails__slot--right1"><MailCard m={at(3)} /></div>
      <div className="mails__slot mails__slot--right2"><MailCard m={at(4)} /></div>
    </div>
  );
}

/* ---------- 2. Tuiles ---------- */
/** Roue « GearSix » en duotone, comme sur byqeeps.com (32 × 32). */
function GearSix({ svgRef }: { svgRef?: Ref<SVGSVGElement> }) {
  return (
    <svg ref={svgRef} className="gear-six" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path
        transform="translate(2 4) scale(0.963 0.92)"
        opacity="0.2"
        d="M26.1717 10.3131L22.1905 8.04564C22.1105 7.90064 22.0267 7.75939 21.9405 7.61939L21.9255 3.11939C20.6673 2.05753 19.2198 1.24284 17.6592 0.71814L13.6592 2.95439C13.4917 2.95439 13.323 2.95439 13.1592 2.95439L9.15924 0.71814C7.59914 1.24455 6.15252 2.06095 4.89549 3.12439L4.87549 7.62439C4.78799 7.76439 4.70424 7.90689 4.62549 8.05064L0.645492 10.3131C0.331711 11.9003 0.331711 13.5335 0.645492 15.1206L4.62674 17.3881C4.70674 17.5331 4.79049 17.6744 4.87674 17.8144L4.89174 22.3144C6.15015 23.3773 7.59804 24.1928 9.15924 24.7181L13.1592 22.4844C13.3267 22.4844 13.4955 22.4844 13.6592 22.4844L17.6592 24.7181C19.218 24.1913 20.6633 23.3749 21.9192 22.3119L21.9392 17.8119C22.0267 17.6719 22.1105 17.5294 22.1892 17.3856L26.1692 15.1231C26.4842 13.5354 26.485 11.9013 26.1717 10.3131ZM13.4092 17.7181C12.4203 17.7181 11.4536 17.4249 10.6314 16.8755C9.80915 16.3261 9.16828 15.5452 8.78984 14.6316C8.41141 13.7179 8.31239 12.7126 8.50532 11.7427C8.69824 10.7728 9.17445 9.88187 9.87371 9.18261C10.573 8.48334 11.4639 8.00714 12.4338 7.81421C13.4037 7.62129 14.409 7.7203 15.3227 8.09874C16.2363 8.47718 17.0172 9.11804 17.5666 9.94029C18.116 10.7625 18.4092 11.7292 18.4092 12.7181C18.4092 14.0442 17.8825 15.316 16.9448 16.2537C16.0071 17.1914 14.7353 17.7181 13.4092 17.7181Z"
      />
      <path
        transform="translate(1 3) scale(1 0.963)"
        d="M14.4094 7.71813C13.2227 7.71813 12.0627 8.07002 11.076 8.72931C10.0893 9.3886 9.32027 10.3257 8.86614 11.422C8.41201 12.5184 8.29319 13.7248 8.52471 14.8887C8.75622 16.0526 9.32766 17.1217 10.1668 17.9608C11.0059 18.7999 12.075 19.3713 13.2389 19.6028C14.4028 19.8343 15.6092 19.7155 16.7055 19.2614C17.8019 18.8073 18.7389 18.0382 19.3982 17.0515C20.0575 16.0649 20.4094 14.9048 20.4094 13.7181C20.4078 12.1273 19.7751 10.6022 18.6502 9.47731C17.5254 8.35245 16.0002 7.71978 14.4094 7.71813ZM14.4094 17.7181C13.6183 17.7181 12.8449 17.4835 12.1871 17.044C11.5293 16.6045 11.0166 15.9798 10.7139 15.2489C10.4111 14.518 10.3319 13.7137 10.4863 12.9378C10.6406 12.1618 11.0216 11.4491 11.581 10.8897C12.1404 10.3303 12.8531 9.94933 13.6291 9.79498C14.405 9.64064 15.2092 9.71986 15.9402 10.0226C16.6711 10.3254 17.2958 10.838 17.7353 11.4958C18.1748 12.1536 18.4094 12.927 18.4094 13.7181C18.4094 14.779 17.988 15.7964 17.2378 16.5466C16.4877 17.2967 15.4703 17.7181 14.4094 17.7181ZM28.1519 11.1194C28.1241 10.9786 28.0662 10.8454 27.9823 10.7289C27.8984 10.6124 27.7904 10.5154 27.6657 10.4444L23.9369 8.31938L23.9219 4.11688C23.9215 3.97214 23.8896 3.82923 23.8285 3.69802C23.7674 3.5668 23.6786 3.45041 23.5682 3.35688C22.2156 2.21275 20.658 1.33596 18.9782 0.773126C18.8459 0.728351 18.7057 0.711781 18.5666 0.724483C18.4275 0.737185 18.2927 0.778878 18.1707 0.846876L14.4094 2.94938L10.6444 0.843126C10.5224 0.774745 10.3873 0.732737 10.248 0.719818C10.1087 0.706899 9.96822 0.723356 9.83567 0.768126C8.15688 1.33457 6.60097 2.21476 5.25067 3.36188C5.14038 3.45527 5.05164 3.57147 4.99057 3.70245C4.9295 3.83344 4.89755 3.9761 4.89692 4.12063L4.87817 8.32688L1.14942 10.4519C1.02467 10.5229 0.916673 10.6199 0.83277 10.7364C0.748866 10.8529 0.691021 10.9861 0.663168 11.1269C0.321913 12.8417 0.321913 14.607 0.663168 16.3219C0.691021 16.4627 0.748866 16.5959 0.83277 16.7123C0.916673 16.8288 1.02467 16.9259 1.14942 16.9969L4.87817 19.1219L4.89317 23.3256C4.89362 23.4704 4.92549 23.6133 4.98656 23.7445C5.04764 23.8757 5.13647 23.9921 5.24692 24.0856C6.59951 25.2298 8.15711 26.1065 9.83692 26.6694C9.9692 26.7142 10.1094 26.7307 10.2485 26.718C10.3876 26.7053 10.5224 26.6636 10.6444 26.5956L14.4094 24.4869L18.1744 26.5931C18.3234 26.6761 18.4914 26.7192 18.6619 26.7181C18.7711 26.7181 18.8796 26.7004 18.9832 26.6656C20.6615 26.0994 22.2174 25.2202 23.5682 24.0744C23.6785 23.981 23.7672 23.8648 23.8283 23.7338C23.8893 23.6028 23.9213 23.4601 23.9219 23.3156L23.9407 19.1094L27.6694 16.9844C27.7942 16.9134 27.9022 16.8163 27.9861 16.6998C28.07 16.5834 28.1278 16.4502 28.1557 16.3094C28.495 14.5959 28.4937 12.8324 28.1519 11.1194ZM26.2769 15.4831L22.7057 17.5144C22.5492 17.6033 22.4196 17.7329 22.3307 17.8894C22.2582 18.0144 22.1819 18.1469 22.1044 18.2719C22.0052 18.4295 21.9524 18.6119 21.9519 18.7981L21.9332 22.8294C20.9733 23.5832 19.9038 24.186 18.7619 24.6169L15.1594 22.6094C15.0099 22.5266 14.8416 22.4836 14.6707 22.4844H14.6469C14.4957 22.4844 14.3432 22.4844 14.1919 22.4844C14.013 22.48 13.8362 22.5232 13.6794 22.6094L10.0744 24.6219C8.93006 24.1943 7.8577 23.5945 6.89442 22.8431L6.88067 18.8181C6.88005 18.6315 6.82723 18.4488 6.72817 18.2906C6.65067 18.1656 6.57442 18.0406 6.50317 17.9081C6.41482 17.7492 6.28528 17.6171 6.12817 17.5256L2.55317 15.4894C2.36817 14.3191 2.36817 13.1271 2.55317 11.9569L6.11817 9.92188C6.27464 9.8329 6.4042 9.70335 6.49317 9.54688C6.56567 9.42188 6.64192 9.28938 6.71942 9.16438C6.81862 9.00674 6.87147 8.82438 6.87192 8.63813L6.89067 4.60688C7.85058 3.85306 8.91999 3.25028 10.0619 2.81938L13.6594 4.82688C13.816 4.91366 13.993 4.95683 14.1719 4.95188C14.3232 4.95188 14.4757 4.95188 14.6269 4.95188C14.8059 4.95683 14.9829 4.91366 15.1394 4.82688L18.7444 2.81438C19.8888 3.24197 20.9611 3.8418 21.9244 4.59313L21.9382 8.61813C21.9388 8.80474 21.9916 8.98747 22.0907 9.14563C22.1682 9.27063 22.2444 9.39563 22.3157 9.52813C22.404 9.68702 22.5336 9.81915 22.6907 9.91063L26.2657 11.9469C26.4531 13.118 26.4552 14.3113 26.2719 15.4831H26.2769Z"
      />
    </svg>
  );
}

/** Tailles mesurées sur byqeeps.com : la tuile « paramètres » passe de 152 × 93 à 193 × 119. */
type TileState = { left: number; top: number; width: number; height: number; font: number; rotate: number };
const PARAM_REST: TileState = { left: 269, top: 160, width: 152, height: 93, font: 7.72, rotate: 0 };
const PARAM_HOVER: TileState = { left: 248, top: 137, width: 193, height: 119, font: 8.72, rotate: -150 };

/**
 * Ressort relevé dans le code de byqeeps.com pour ce composant :
 * { type: "spring", stiffness: 500, damping: 60, mass: 1 } — appliqué à l'agrandissement de la tuile
 * ET à la rotation de la roue (0 → -150°), à l'aller comme au retour.
 */
const SPRING = { stiffness: 500, damping: 60, mass: 1 };

/**
 * Animation de la tuile au survol du bloc, simulée image par image (requestAnimationFrame) avec le même
 * ressort physique que Framer : mêmes durées, même rotation, et la vitesse est conservée si la souris
 * ressort en cours de route. Aucune dépendance aux transitions CSS (identique sur Safari et Chrome).
 */
function useParamTileAnimation(hovered: boolean) {
  const tileRef = useRef<HTMLButtonElement>(null);
  const gearRef = useRef<SVGSVGElement>(null);
  const value = useRef<TileState>({ ...PARAM_REST });
  const velocity = useRef<TileState>({ left: 0, top: 0, width: 0, height: 0, font: 0, rotate: 0 });
  const frame = useRef(0);

  useEffect(() => {
    const tile = tileRef.current;
    const gear = gearRef.current;
    if (!tile || !gear) return;
    const target = hovered ? PARAM_HOVER : PARAM_REST;
    const keys = Object.keys(target) as (keyof TileState)[];

    const paint = (s: TileState) => {
      tile.style.left = `${s.left}px`;
      tile.style.top = `${s.top}px`;
      tile.style.width = `${s.width}px`;
      tile.style.height = `${s.height}px`;
      tile.style.fontSize = `${s.font}px`;
      gear.style.transform = `rotate(${s.rotate}deg)`;
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      value.current = { ...target };
      paint(target);
      return;
    }

    let last = performance.now();
    const step = (now: number) => {
      // intégration par pas de 1 ms (stable même si une image est en retard)
      let dt = Math.min(64, now - last);
      last = now;
      const x = value.current;
      const v = velocity.current;
      while (dt > 0) {
        const h = Math.min(1, dt) / 1000;
        for (const k of keys) {
          const accel = (-SPRING.stiffness * (x[k] - target[k]) - SPRING.damping * v[k]) / SPRING.mass;
          v[k] += accel * h;
          x[k] += v[k] * h;
        }
        dt -= 1;
      }
      const settled = keys.every((k) => Math.abs(x[k] - target[k]) < 0.01 && Math.abs(v[k]) < 0.05);
      if (settled) {
        keys.forEach((k) => {
          x[k] = target[k];
          v[k] = 0;
        });
      }
      paint(x);
      frame.current = settled ? 0 : requestAnimationFrame(step);
    };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [hovered]);

  return { tileRef, gearRef };
}

function TilesVisual({ tiles, onMore, hovered }: { tiles: Features["tiles"]; onMore: () => void; hovered: boolean }) {
  const data = tiles.slice(0, 3);
  const pos = ["t1", "t2", "t3"];
  const { tileRef, gearRef } = useParamTileAnimation(hovered);
  const site = useSite();
  return (
    <div className="tiles">
      <span className="tiles__ghost tiles__ghost--tl" />
      <span className="tiles__ghost tiles__ghost--tr" />
      {data.map((t, i) => (
        <div key={i} className={`tile tile--${pos[i]}`}>
          <p className="tile__value">
            <Icon name={t.icon} />
            {t.value}
            {t.unit && <small>{t.unit}</small>}
          </p>
          <p className="tile__label">{t.label}</p>
        </div>
      ))}
      <button ref={tileRef} type="button" className="tile tile--param" onClick={onMore}>
        <GearSix svgRef={gearRef} />
        <span>{site.t("ill.stack")}</span>
      </button>
      <span className="tiles__ghost tiles__ghost--bl" />
      <span className="tiles__ghost tiles__ghost--br" />
    </div>
  );
}

/* ---------- 3. Fiches : expériences et formations en boucle ---------- */
type LoopRow = CandidateRow & { target: string; kind: "exp" | "edu" };

/** Fait défiler un élément jusqu'à une carte du parcours et la met en lumière un instant. */
function spotlight(id: string) {
  // expériences : elles sont dans la frise, on lui demande d'afficher la bonne puis on y descend
  if (id.startsWith("xp-")) {
    window.dispatchEvent(new CustomEvent("xp:show", { detail: id.slice(3) }));
    id = "experiences";
  }
  // formations : elles sont dans les cartes « pass » ; on y descend et la carte passe devant
  let el = document.getElementById(id);
  if (id.startsWith("edu-")) {
    window.dispatchEvent(new CustomEvent("edu:show", { detail: id.slice(4) }));
    el = el?.closest<HTMLElement>(".feature") ?? null;
  }
  if (!el) return;
  const box = el;
  // haut de la carte juste sous la barre de navigation (80 px), même pour une longue carte d'expérience
  const top = box.getBoundingClientRect().top + window.scrollY - 104;
  window.scrollTo({ top, behavior: "smooth" });
  // attribut data (et non une classe) : React ne l'écrase pas quand la carte se ré-affiche
  delete box.dataset.spotlight;
  window.setTimeout(() => {
    box.dataset.spotlight = "";
    window.setTimeout(() => delete box.dataset.spotlight, 2200);
  }, 450);
}

const LOOP_SPEED = 18; // px/s vers le haut
const LOOP_HOVER_FACTOR = 0.15; // au survol d'une carte : ralenti à 15 %

/**
 * Colonne de fiches qui défile en boucle (requestAnimationFrame). Les fiches s'estompent, rétrécissent
 * et se floutent en s'éloignant du centre du bloc, comme la pile de candidats de Qeeps.
 * Survol d'une fiche : le défilement ralentit en douceur, la fiche passe au premier plan et
 * révèle « Voir cette expérience ».
 */
function ExperienceLoop({ rows }: { rows: LoopRow[] }) {
  const { t } = useSite();
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hoveringRef = useRef(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let offset = 0;
    let speed = reduce ? 0 : LOOP_SPEED;
    let last = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.064, (now - last) / 1000);
      last = now;
      const target = reduce ? 0 : hoveringRef.current ? LOOP_SPEED * LOOP_HOVER_FACTOR : LOOP_SPEED;
      speed += (target - speed) * (1 - Math.exp(-dt / 0.25)); // ralenti progressif (~0,25 s)
      const group = track.scrollHeight / 2;
      if (group > 0) offset = (offset + speed * dt) % group;
      track.style.transform = `translate3d(0, ${-offset}px, 0)`;

      // profondeur : 0 au centre du bloc → 1 sur les bords
      const vp = viewport.getBoundingClientRect();
      const mid = vp.top + vp.height / 2;
      for (const item of Array.from(track.children) as HTMLElement[]) {
        const r = item.getBoundingClientRect();
        const d = Math.min(1, Math.abs(r.top + r.height / 2 - mid) / (vp.height / 2));
        item.style.setProperty("--d", d.toFixed(3));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rows.length]);

  if (!rows.length) return null;
  const loop = [...rows, ...rows]; // deux copies pour une boucle sans couture

  return (
    <div className={`xploop ${hovered !== null ? "has-hover" : ""}`} ref={viewportRef}>
      <div className="xploop__track" ref={trackRef}>
        {loop.map((row, i) => {
          const copy = i >= rows.length;
          return (
            <div
              key={i}
              className={`xploop__item ${hovered === i ? "is-hover" : ""}`}
              aria-hidden={copy || undefined}
              onMouseEnter={() => {
                hoveringRef.current = true;
                setHovered(i);
              }}
              onMouseLeave={() => {
                hoveringRef.current = false;
                setHovered((h) => (h === i ? null : h));
              }}
            >
              <span className="xploop__panel" aria-hidden="true" />
              <CandidateCard row={row} active={false} />
              <button
                type="button"
                className="xploop__btn"
                tabIndex={copy ? -1 : 0}
                onClick={() => spotlight(row.target)}
              >
                {row.kind === "exp" ? t("ill.seeXp") : t("ill.seeEdu")}
                <Icon name="arrow" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- 4. Cartes « pass » (bloc Certification de byqeeps.com) ---------- */
/*
 * Reproduction des composants Framer de Qeeps (relevés dans le code du site), devenus une
 * pile de cartes de formation :
 *  - « hover_card°pass » : conteneur 566 × 305 ; au survol, la carte arrière glisse de (-2, -2) px
 *    et la carte avant de (+3, +3) px (tween 0,4 s, ease [.44, 0, .56, 1]) ;
 *  - « pass1 » (arrière, -6°) et « pass2 » (avant, +3°) : au survol de la carte elle-même,
 *    pass2 → rotateX 10°, rotateY -5°, scale 1.0125, brightness 1.1 ;
 *    pass1 → rotateX -5°, rotateY 5°, scale 0.98, brightness 1.05 (tween 0,8 s, ease [.12, .23, .5, 1]).
 * Icônes : Phosphor « SealCheck » (licence MIT), comme sur le site.
 */
const SEAL_SHAPE = "M232,128c0,12.51-17.82,21.95-22.68,33.69-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68c-11.32-4.68-30.65,1.42-39.85-7.78s-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128Z";
const SEAL_LINE = "M225.86,102.82c-3.77-3.94-7.67-8-9.14-11.57-1.36-3.27-1.44-8.69-1.52-13.94-.15-9.76-.31-20.82-8-28.51s-18.75-7.85-28.51-8c-5.25-.08-10.67-.16-13.94-1.52-3.56-1.47-7.63-5.37-11.57-9.14C146.28,23.51,138.44,16,128,16s-18.27,7.51-25.18,14.14c-3.94,3.77-8,7.67-11.57,9.14C88,40.64,82.56,40.72,77.31,40.8c-9.76.15-20.82.31-28.51,8S41,67.55,40.8,77.31c-.08,5.25-.16,10.67-1.52,13.94-1.47,3.56-5.37,7.63-9.14,11.57C23.51,109.72,16,117.56,16,128s7.51,18.27,14.14,25.18c3.77,3.94,7.67,8,9.14,11.57,1.36,3.27,1.44,8.69,1.52,13.94.15,9.76.31,20.82,8,28.51s18.75,7.85,28.51,8c5.25.08,10.67.16,13.94,1.52,3.56,1.47,7.63,5.37,11.57,9.14C109.72,232.49,117.56,240,128,240s18.27-7.51,25.18-14.14c3.94-3.77,8-7.67,11.57-9.14,3.27-1.36,8.69-1.44,13.94-1.52,9.76-.15,20.82-.31,28.51-8s7.85-18.75,8-28.51c.08-5.25.16-10.67,1.52-13.94,1.47-3.56,5.37-7.63,9.14-11.57C232.49,146.28,240,138.44,240,128S232.49,109.73,225.86,102.82Zm-11.55,39.29c-4.79,5-9.75,10.17-12.38,16.52-2.52,6.1-2.63,13.07-2.73,19.82-.1,7-.21,14.33-3.32,17.43s-10.39,3.22-17.43,3.32c-6.75.1-13.72.21-19.82,2.73-6.35,2.63-11.52,7.59-16.52,12.38S132,224,128,224s-9.15-4.92-14.11-9.69-10.17-9.75-16.52-12.38c-6.1-2.52-13.07-2.63-19.82-2.73-7-.1-14.33-.21-17.43-3.32s-3.22-10.39-3.32-17.43c-.1-6.75-.21-13.72-2.73-19.82-2.63-6.35-7.59-11.52-12.38-16.52S32,132,32,128s4.92-9.15,9.69-14.11,9.75-10.17,12.38-16.52c2.52-6.1,2.63-13.07,2.73-19.82.1-7,.21-14.33,3.32-17.43S70.51,56.9,77.55,56.8c6.75-.1,13.72-.21,19.82-2.73,6.35-2.63,11.52-7.59,16.52-12.38S124,32,128,32s9.15,4.92,14.11,9.69,10.17,9.75,16.52,12.38c6.1,2.52,13.07,2.63,19.82,2.73,7,.1,14.33.21,17.43,3.32s3.22,10.39,3.32,17.43c.1,6.75.21,13.72,2.73,19.82,2.63,6.35,7.59,11.52,12.38,16.52S224,124,224,128,219.08,137.15,214.31,142.11ZM173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34Z";

function SealCheck({ className, gradientId }: { className?: string; gradientId?: string }) {
  const fill = gradientId ? `url(#${gradientId})` : "currentColor";
  return (
    <svg className={className} viewBox="0 0 256 256" aria-hidden="true">
      {gradientId && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
        </defs>
      )}
      <path d={SEAL_SHAPE} fill={fill} opacity="0.2" />
      <path d={SEAL_LINE} fill={fill} />
    </svg>
  );
}

function PassLogo({ light }: { light?: boolean }) {
  const { t } = useSite();
  return <span className={`pass__logo ${light ? "pass__logo--light" : ""}`}>{t("brand")}.</span>;
}

/* Formations : une carte « pass » par formation. Un clic fait passer la carte au premier
 * plan : l'ancienne carte s'envole sur le côté et repasse derrière, la nouvelle bondit
 * devant en se retournant légèrement, puis un reflet balaie sa surface. Chaque carte garde
 * sa couleur (pétrole, claire, pétrole…), quelle que soit sa place dans la pile. */
type Edu = Profile["education"][number];

const SLOTS = [
  { x: 0, y: 0, r: 3, s: 1 },
  { x: -62, y: -14, r: -6, s: 0.93 },
  { x: -100, y: -28, r: -10, s: 0.87 }
];
const slotOf = (k: number) => SLOTS[Math.min(k, SLOTS.length - 1)];
const place = (k: number, extra = "") => {
  const s = slotOf(k);
  return `perspective(1400px) translate(${s.x}px, ${s.y}px) rotate(${s.r}deg) scale(${s.s})${extra}`;
};
const REDUCED_MOTION = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function EduCard({ ed, profile, dark, id }: { ed: Edu; profile: Profile; dark: boolean; id: number }) {
  const { t } = useSite();
  const promo = ed.period.match(/\d{4}/g)?.pop();
  return (
    <div className="pass__mains">
      <SealCheck className="pass__seal" gradientId={dark ? `pass-seal-${id}` : undefined} />
      <div className="pass__top">
        <PassLogo light={dark} />
        {ed.badge && (
          <span className="pass__tag">
            <SealCheck className="pass__tag-icon" />
            {ed.badge}
          </span>
        )}
      </div>
      <div className="pass__bottom">
        <div className="pass__col">
          <div className="pass__pair">
            <p className="pass__label">{t("ill.identity")}</p>
            <p className="pass__value">{profile.fullName}</p>
          </div>
          <div className="pass__pair">
            <p className="pass__label">{ed.title || t("ill.training")}</p>
            <p className="pass__value pass__value--tight">{ed.school}</p>
          </div>
        </div>
        <div className="pass__col pass__col--end">
          <p className="pass__label">{promo ? `${t("ill.promo")} ${promo}` : ed.period}</p>
        </div>
      </div>
    </div>
  );
}

function EduDeck({ profile }: { profile: Profile }) {
  const list = profile.education;
  const [order, setOrder] = useState(() => list.map((_, i) => i));
  const [front, setFront] = useState(0);
  const [shine, setShine] = useState(0);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const running = useRef<Animation[]>([]);
  const busy = useRef(false);

  // la liste change dans l'admin : on repart de l'ordre d'origine
  useEffect(() => {
    setOrder(list.map((_, i) => i));
    setFront(0);
  }, [list.length]);

  // les animations terminées sont retirées une fois le nouvel ordre affiché (pas de saut)
  useLayoutEffect(() => {
    running.current.forEach((a) => a.cancel());
    running.current = [];
    busy.current = false;
  }, [order]);

  const bringToFront = (target: number) => {
    if (busy.current || order[0] === target || !list[target]) return;
    const next = [target, ...order.filter((i) => i !== target)];
    setFront(target);
    setShine((s) => s + 1);
    if (REDUCED_MOTION) return setOrder(next);
    busy.current = true;
    const anims: Animation[] = [];
    order.forEach((idx, from) => {
      const el = cards.current[idx];
      if (!el) return;
      const to = next.indexOf(idx);
      let frames: Keyframe[];
      if (idx === target) {
        // la carte choisie jaillit de la pile, pivote et retombe devant avec un léger rebond
        frames = [
          { transform: place(from), zIndex: 10 - from, offset: 0 },
          { transform: "perspective(1400px) translate(-150px, -86px) rotate(-15deg) rotateY(18deg) scale(1.05)", zIndex: 10 - from, offset: 0.42 },
          { zIndex: 30, offset: 0.5 },
          { transform: "perspective(1400px) translate(8px, 6px) rotate(5deg) rotateY(-4deg) scale(1.04)", zIndex: 30, offset: 0.8 },
          { transform: place(0), zIndex: 30, offset: 1 }
        ];
      } else if (from === 0) {
        // l'ancienne carte avant s'envole vers la droite puis glisse derrière la pile
        frames = [
          { transform: place(0), zIndex: 20, offset: 0 },
          { transform: "perspective(1400px) translate(200px, 46px) rotate(19deg) rotateY(-22deg) scale(0.96)", zIndex: 20, offset: 0.4 },
          { zIndex: 10 - to, offset: 0.5 },
          { transform: place(to), zIndex: 10 - to, offset: 1 }
        ];
      } else {
        frames = [
          { transform: place(from), zIndex: 10 - from },
          { transform: place(to), zIndex: 10 - to }
        ];
      }
      anims.push(el.animate(frames, { duration: 1050, easing: "cubic-bezier(0.6, 0.02, 0.22, 1)", fill: "forwards" }));
    });
    running.current = anims;
    Promise.all(anims.map((a) => a.finished)).then(() => setOrder(next), () => (busy.current = false));
  };

  // « Voir cette formation » (fiches de la colonne) : la carte demandée passe devant
  const bring = useRef(bringToFront);
  bring.current = bringToFront;
  useEffect(() => {
    const onShow = (e: Event) => window.setTimeout(() => bring.current(Number((e as CustomEvent).detail)), 650);
    window.addEventListener("edu:show", onShow);
    return () => window.removeEventListener("edu:show", onShow);
  }, []);

  if (!list.length) return null;
  return (
    <div className="pass edu-deck">
      {list.map((ed, idx) => {
        const slot = order.indexOf(idx);
        // chaque carte garde sa couleur : pétrole, claire, pétrole…
        const dark = idx % 2 === 0;
        return (
          <div
            key={idx}
            id={`edu-${idx}`}
            ref={(el) => (cards.current[idx] = el)}
            className={`edu-card ${dark ? "is-dark" : ""}`}
            data-slot={Math.min(slot, 3)}
            style={{ transform: place(slot), zIndex: 10 - slot }}
            onClick={() => bringToFront(slot === 0 ? order[1] ?? idx : idx)}
            role="button"
            tabIndex={0}
            aria-label={`${ed.school} — ${ed.title}`}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), bringToFront(slot === 0 ? order[1] ?? idx : idx))}
          >
            <div className="edu-card__lift">
              <div className="pass__card edu-card__face">
                <EduCard ed={ed} profile={profile} dark={dark} id={idx} />
                {idx === front && shine > 0 && <span key={shine} className="edu-card__shine" aria-hidden="true" />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FeatureBlocks({ profile }: { profile: Profile }) {
  const { t } = useSite();
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const rows: LoopRow[] = [
    ...profile.experiences.map((xp, i) => ({
      target: `xp-${xp.id}`,
      kind: "exp" as const,
      initials: xp.company.replace(/^Groupe /, "").slice(0, 2).toUpperCase(),
      logo: xp.logoUrl || undefined,
      name: xp.company,
      handle: `${xp.role} · ${xp.period}`,
      hue: [190, 150][i % 2],
      tags: [
        { icon: "briefcase", label: xp.role.split(" ")[0] },
        { icon: "badge", label: xp.contract },
        { icon: "check", label: xp.env[0] ?? "Prod", tone: "green" as const },
        { icon: "pin", label: xp.mode }
      ]
    })),
    ...profile.education.map((ed, i) => ({
      target: `edu-${i}`,
      kind: "edu" as const,
      initials: ed.school.slice(0, 2).toUpperCase(),
      name: ed.school,
      handle: ed.title,
      hue: [25, 270][i % 2],
      tags: [
        { icon: "graduation", label: t("ill.training") },
        { icon: "clock", label: ed.period },
        { icon: "check", label: ed.tags[0] ?? "Diplôme", tone: "green" as const }
      ]
    }))
  ];

  const f = profile.sections?.features;
  const variants = ["mails", "tiles", "people", "cert"] as const;
  const visuals = {
    mails: <MailsVisual messages={f?.messages ?? []} />,
    tiles: (hovered: boolean) => <TilesVisual tiles={f?.tiles ?? []} onMore={() => scrollTo("stack")} hovered={hovered} />,
    people: <ExperienceLoop rows={rows} />,
    cert: <EduDeck profile={profile} />,
    docs: <DocsVisual profile={profile} />
  };

  return (
    <div className="features">
      {(f?.blocks ?? []).map((b, i) => {
        // chaque bloc choisit son illustration (par défaut : dans l'ordre)
        const v = b.visual ?? variants[i % 4];
        return (
          <FeatureBlock
            key={i}
            id={`bloc-${i}`}
            title={b.title}
            text={b.text}
            reverse={v === "tiles" || v === "cert"}
            variant={v}
            visual={visuals[v]}
            edit={v === "docs" ? { id: "candidature", label: "Ma candidature" } : undefined}
          />
        );
      })}
    </div>
  );
}
