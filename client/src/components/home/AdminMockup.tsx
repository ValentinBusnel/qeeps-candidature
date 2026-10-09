import { useEffect, useState, type CSSProperties } from "react";
import "./admin-mockup.css";

/**
 * Le haut de page montre le vrai back-office du site : une capture haute définition de
 * l'onglet « Mon site » (section « Comment je travaille », bloc « Une stack complète »
 * ouvert, et ses composants repris de byqeeps.com dans l'aperçu), au gabarit réel de
 * l'admin (1440 × 916) réduit dans le cadre 876 × 557.
 *
 * Par-dessus, quelques touches de vie discrètes, placées au pixel près sur la capture :
 * le point « Aperçu en direct » qui bat, le titre du bloc retapé de temps en temps (le champ,
 * la ligne repliée et l'aperçu changent ensemble) et le bloc de l'aperçu qui s'éclaire.
 */
const SHOT = "/hero/admin-mon-site.webp?v=4";
const FULL = "Une stack complète";
const KEEP = "Une stack ".length;

const box = (left: number, top: number, width: number, height: number, extra: CSSProperties = {}): CSSProperties => ({
  left,
  top,
  width,
  height,
  ...extra
});

const REDUCED = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function AdminMockup() {
  const [n, setN] = useState(FULL.length);
  const [typing, setTyping] = useState(false);
  const [wave, setWave] = useState(0);

  // toutes les ~9 s : on efface le dernier mot, on le retape, l'aperçu s'éclaire
  useEffect(() => {
    if (REDUCED) return;
    const timers: number[] = [];
    let t = 0;
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, (t += ms)));
    const cycle = () => {
      at(4200, () => setTyping(true));
      for (let k = FULL.length - 1; k >= KEEP; k--) at(42, () => setN(k));
      at(380, () => {});
      for (let k = KEEP + 1; k <= FULL.length; k++) at(85 + ((k * 37) % 50), () => setN(k));
      at(160, () => {
        setTyping(false);
        setWave((w) => w + 1);
      });
      at(3200, () => {
        timers.length = 0;
        t = 0;
        cycle();
      });
    };
    cycle();
    return () => timers.forEach(clearTimeout);
  }, []);

  const text = FULL.slice(0, n);

  return (
    <div className="mock mock--admin" aria-hidden="true">
      <div className="amock">
        <img className="amock-shot" src={SHOT} width={1440} height={916} alt="" decoding="async" draggable={false} />

        {/* le point « Aperçu en direct » */}
        <span className="amock-pulse" style={box(908, 124, 8, 8)} />

        {/* le titre du bloc, dans sa ligne (« 02 Une stack complète ») */}
        <span className="amock-item-name" style={box(334.6, 165.5, 200, 21)}>
          {text}
        </span>

        {/* champ « Titre » en cours de modification */}
        <span className="amock-type" style={box(308, 231, 500, 38)}>
          {text}
          <i className={`amock-caret ${typing ? "is-typing" : ""}`} />
        </span>

        {/* le même titre dans le bloc de l'aperçu (réduit comme dans l'admin) */}
        <span className="amock-pv-text" style={box(1182.3, 380.9, 112, 11.34)}>
          {text}
        </span>

        {/* le bloc de l'aperçu : halo qui respire, onde à chaque mise à jour */}
        <span className="amock-halo" style={box(997.6, 345.6, 326, 122.1)} />
        {wave > 0 && <span key={wave} className="amock-wave" style={box(997.6, 345.6, 326, 122.1)} />}
      </div>
    </div>
  );
}
