import { useState } from "react";
import { stackLogo } from "../lib/stackLogos";
import { Icon } from "./Icons";

/** Logo d'une technologie avec son nom en petit dessous ; logo par défaut si inconnu. */
export default function StackLogo({ name }: { name: string }) {
  const src = stackLogo(name);
  const [failed, setFailed] = useState(false);
  return (
    <figure className="stack-logo">
      <span className="stack-logo__img">
        {src && !failed ? (
          <img src={src} alt="" draggable={false} onError={() => setFailed(true)} />
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
