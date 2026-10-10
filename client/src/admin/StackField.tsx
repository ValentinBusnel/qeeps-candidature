import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { adminApi } from "../api";
import { Icon } from "../components/Icons";
import { catalogIconUrl, catalogLogoFile, loadCatalog, searchCatalog, simpleColor, type CatalogEntry } from "../lib/stackCatalog";
import { normalizeStack, setStackLogos, stackLogo, useStackLogo } from "../lib/stackLogos";
import { useToast } from "./ui";

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/** Icône d'une entrée du catalogue : Devicon en couleur, Simple Icons teinte à sa couleur de marque. */
function CatalogIcon({ e }: { e: CatalogEntry }) {
  if (e.kind === "devicon") return <img src={catalogIconUrl(e)} alt="" loading="lazy" draggable={false} />;
  const url = `url("${catalogIconUrl(e)}")`;
  return <span className="adm-stack__mask" style={{ background: simpleColor(e.extra), WebkitMaskImage: url, maskImage: url } as CSSProperties} />;
}

/** Nom avec la partie tapée mise en valeur. */
function Highlight({ text, query }: { text: string; query: string }) {
  const i = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (!query.trim() || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.trim().length)}</mark>
      {text.slice(i + query.trim().length)}
    </>
  );
}

/** Étiquette d'une techno : son logo (cliquable pour le changer), son nom, la croix. */
function StackTag({
  name,
  busy,
  onRemove,
  onLogo,
  drag
}: {
  name: string;
  busy: boolean;
  onRemove: () => void;
  onLogo: (file: File) => void;
  drag: { onDragStart: () => void; onDrop: () => void };
}) {
  const src = useStackLogo(name);
  const [broken, setBroken] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const hasLogo = !!src && broken !== src;
  return (
    <span className={`tag adm-tag adm-stack__tag ${hasLogo ? "" : "is-bare"}`} draggable onDragStart={drag.onDragStart} onDragOver={(e) => e.preventDefault()} onDrop={drag.onDrop}>
      <button
        type="button"
        className={`adm-stack__logo ${busy ? "is-busy" : ""}`}
        onClick={() => file.current?.click()}
        title={hasLogo ? "Changer le logo" : "Ajouter un logo"}
        aria-label={hasLogo ? `Changer le logo de ${name}` : `Ajouter un logo à ${name}`}
      >
        {busy ? <span className="adm-stack__spin" /> : hasLogo ? <img src={src!} alt="" draggable={false} onError={() => setBroken(src)} /> : <Icon name="plus" />}
      </button>
      {name}
      <button type="button" className="adm-stack__x" onClick={onRemove} aria-label={`Retirer ${name}`}>
        <Icon name="x" />
      </button>
      <input
        ref={file}
        type="file"
        accept="image/svg+xml,image/png,image/webp,image/jpeg"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onLogo(f);
        }}
      />
    </span>
  );
}

/**
 * Champ de technologies avec autocomplétion : ~3 600 technos et leurs logos.
 * Une techno du catalogue arrive avec son logo (recopié dans les fichiers du site) ;
 * une techno inconnue s'ajoute quand même, et on peut lui donner un logo en cliquant dessus.
 */
export function StackField({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  const toast = useToast();
  const id = useId();
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const dragFrom = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const warm = () => {
    if (catalog) return;
    loadCatalog()
      .then((c) => {
        setCatalog(c);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  };

  const results = useMemo(() => (catalog ? searchCatalog(catalog, input).filter((e) => !value.some((v) => normalizeStack(v) === e.norm)) : []), [catalog, input, value]);
  const q = input.trim();
  const exact = !!catalog && searchCatalog(catalog, q, 1)[0]?.norm === normalizeStack(q);
  const already = value.some((v) => normalizeStack(v) === normalizeStack(q));
  const options: ({ type: "entry"; e: CatalogEntry } | { type: "custom" })[] = [
    ...results.map((e) => ({ type: "entry" as const, e })),
    ...(q && !exact && !already ? [{ type: "custom" as const }] : [])
  ];
  useEffect(() => setActive(0), [input]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(".is-active")?.scrollIntoView({ block: "nearest" });
  }, [active]);

  async function saveLogo(name: string, getUrl: () => Promise<string>) {
    setBusy((b) => ({ ...b, [name]: true }));
    try {
      setStackLogos(await adminApi.setStackLogo(name, await getUrl()));
    } catch (err) {
      toast((err as Error).message || "Logo non enregistré", "error");
    } finally {
      setBusy((b) => ({ ...b, [name]: false }));
    }
  }

  function add(name: string) {
    const clean = name.trim();
    if (!clean || value.some((v) => normalizeStack(v) === normalizeStack(clean))) return false;
    onChange([...value, clean]);
    setInput("");
    return true;
  }

  function pick(o: (typeof options)[number]) {
    if (o.type === "custom") {
      if (add(q)) toast(`« ${q} » ajouté. Cliquez sur son logo pour en mettre un.`);
      return;
    }
    const e = o.e;
    if (!add(e.name)) return;
    // déjà un logo pour ce nom (logo fourni avec le site ou choisi avant) : rien à faire
    if (stackLogo(e.name)) return;
    saveLogo(e.name, async () => {
      try {
        const file = await catalogLogoFile(e);
        return (await adminApi.upload(file, "stack-logos")).url;
      } catch {
        return catalogIconUrl(e); // à défaut, l'icône reste servie par le CDN
      }
    });
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + options.length) % options.length);
    } else if (e.key === "Enter" || (e.key === "," && q)) {
      e.preventDefault();
      const o = options[active] ?? (q && !already ? { type: "custom" as const } : null);
      if (o) pick(o);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !input && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  const showList = open && !!q;

  return (
    <div className="field adm-stack">
      <label htmlFor={id}>{label}</label>
      <div className={`adm-tags adm-stack__box ${showList ? "is-open" : ""}`}>
        {value.map((tag, i) => (
          <StackTag
            key={tag}
            name={tag}
            busy={!!busy[tag]}
            onRemove={() => onChange(value.filter((_, j) => j !== i))}
            onLogo={(file) => saveLogo(tag, async () => (await adminApi.upload(file, "stack-logos")).url)}
            drag={{
              onDragStart: () => (dragFrom.current = i),
              onDrop: () => {
                if (dragFrom.current !== null) onChange(move(value, dragFrom.current, i));
                dragFrom.current = null;
              }
            }}
          />
        ))}
        <input
          id={id}
          className="adm-tags__input"
          value={input}
          placeholder={value.length ? "Ajouter une techno…" : "React, Docker, Figma…"}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          onFocus={() => {
            warm();
            setOpen(true);
          }}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
            warm();
          }}
          onKeyDown={onKey}
          onBlur={() => setOpen(false)}
        />
        {showList && (
          <ul className="adm-stack__list" id={`${id}-list`} role="listbox" ref={listRef} onMouseDown={(e) => e.preventDefault()}>
            {!catalog && !failed && (
              <li className="adm-stack__info">
                <span className="adm-stack__spin" /> Chargement des technologies…
              </li>
            )}
            {failed && <li className="adm-stack__info">Catalogue indisponible : la techno sera ajoutée telle quelle.</li>}
            {options.map((o, i) => (
              <li
                key={o.type === "entry" ? o.e.norm : "custom"}
                role="option"
                aria-selected={i === active}
                className={`adm-stack__opt ${i === active ? "is-active" : ""} ${o.type === "custom" ? "is-custom" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
              >
                <span className="adm-stack__icon">{o.type === "entry" ? <CatalogIcon e={o.e} /> : <Icon name="plus" />}</span>
                <span className="adm-stack__name">
                  {o.type === "entry" ? (
                    <Highlight text={o.e.name} query={q} />
                  ) : (
                    <>
                      Ajouter « <strong>{q}</strong> »
                    </>
                  )}
                </span>
                <span className="adm-stack__meta">{o.type === "entry" ? (i === active ? "Entrée ↵" : "") : "logo à ajouter"}</span>
              </li>
            ))}
            {catalog && !options.length && <li className="adm-stack__info">Déjà dans la liste.</li>}
          </ul>
        )}
      </div>
      {hint && <p className="adm-hint">{hint}</p>}
    </div>
  );
}
