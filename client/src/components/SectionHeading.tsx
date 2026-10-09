interface Props {
  overline: string;
  title: string;
  titleSecondLine?: string;
  /** Titre sur une ligne suivi d'un défilé (« Agences partenaires ») : 36 px d'écart au lieu de 88 */
  tight?: boolean;
  /** Écart sous le titre, en px (par défaut 88, comme « Comment ça fonctionne ? ») */
  gap?: number;
}

/** Overline grise 18 px + titre pétrole 36 px, centrés — mesures de byqeeps.com. */
export default function SectionHeading({ overline, title, titleSecondLine, tight = false, gap }: Props) {
  return (
    <div className={`section-heading ${tight ? "section-heading--tight" : ""}`} style={gap !== undefined ? { marginBottom: gap } : undefined}>
      {overline && <p className="t-overline">{overline}</p>}
      <h2 className="t-h2">
        {title}
        {titleSecondLine && (
          <>
            <br />
            {titleSecondLine}
          </>
        )}
      </h2>
    </div>
  );
}
