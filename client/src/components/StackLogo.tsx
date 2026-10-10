import { useState } from "react";
import { useStackLogo } from "../lib/stackLogos";
import { Icon } from "./Icons";

/** Logo d'une technologie avec son nom en petit dessous ; logo par défaut si inconnu. */
export default function StackLogo({ name }: { name: string }) {
  const src = useStackLogo(name);
  const [failedSrc, setFailed] = useState<string | null>(null);
  const failed = failedSrc === src;
  return (
    <figure className="stack-logo">
      <span className="stack-logo__img">
        {src && !failed ? (
          <img src={src} alt="" draggable={false} onError={() => setFailed(src)} />
        ) : (
          <span className="stack-logo__default" aria-hidden="true">
            <Icon name="code" />
          </span>
        )}
      </span>
      <figcaption className="stack-logo__name">{name}</figcaption>
    </figure>
  );
}
