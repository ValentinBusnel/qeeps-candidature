import { Fragment, type ReactNode } from "react";

/** Transforme `**mot**` en <strong>mot</strong> (mise en valeur pétrole dans les descriptions). */
export function rich(text: string | undefined): ReactNode {
  if (!text) return null;
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}
