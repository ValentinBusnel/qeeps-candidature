import { Icon } from "./Icons";

export interface CandidateRow {
  initials: string;
  /** logo de l'entreprise (à la place des initiales) */
  logo?: string;
  name: string;
  handle: string;
  tags: { icon: string; label: string; tone?: "green" }[];
  hue: number;
}

/** Fiche candidat façon Qeeps (bloc « Identification »), réutilisée pour mes expériences. */
export default function CandidateCard({
  row,
  active,
  onAction
}: {
  row: CandidateRow;
  active: boolean;
  onAction?: () => void;
}) {
  return (
    <div className={`cand ${active ? "is-active" : ""}`}>
      {row.logo ? (
        <span className="cand__avatar cand__avatar--logo">
          <img src={row.logo} alt="" loading="lazy" />
        </span>
      ) : (
        <span
          className="cand__avatar"
          style={{ background: `hsl(${row.hue} 55% 86%)`, color: `hsl(${row.hue} 45% 28%)` }}
        >
          {row.initials}
        </span>
      )}
      <div className="cand__body">
        <p className="cand__name">{row.name}</p>
        <p className="cand__handle">{row.handle}</p>
        <div className="cand__tags">
          {row.tags.map((t) => (
            <span key={t.label} className={`cand__tag ${t.tone === "green" ? "cand__tag--green" : ""}`}>
              <Icon name={t.icon} />
              {t.label}
            </span>
          ))}
        </div>
      </div>
      {active && onAction && (
        <button type="button" className="people__btn" onClick={onAction}>
          Voir cette expérience
        </button>
      )}
    </div>
  );
}
