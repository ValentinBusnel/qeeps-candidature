import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes
} from "react";
import { adminApi } from "../api";
import { Icon } from "../components/Icons";

/* =====================================================================
   Notifications (toasts)
   ===================================================================== */
type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <Icon name={t.tone === "ok" ? "check" : "x"} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* =====================================================================
   Confirmation (remplace window.confirm)
   ===================================================================== */
type ConfirmOptions = { title: string; text?: string; confirmLabel?: string; danger?: boolean };
const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })),
    []
  );
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="adm-dialog" role="alertdialog" aria-modal="true" onClick={() => close(false)}>
          <div className="adm-dialog__panel" onClick={(e) => e.stopPropagation()}>
            <p className="adm-dialog__title">{state.title}</p>
            {state.text && <p className="adm-dialog__text">{state.text}</p>}
            <div className="adm-dialog__actions">
              <button type="button" className="btn btn--secondary" onClick={() => close(false)} autoFocus>
                Annuler
              </button>
              <button
                type="button"
                className={`btn ${state.danger ? "btn--danger" : "btn--primary"}`}
                onClick={() => close(true)}
              >
                {state.confirmLabel ?? "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

/* =====================================================================
   Mise en page
   ===================================================================== */
export function PageHeader({ title, subtitle, actions, overline }: { title: string; subtitle?: string; actions?: ReactNode; overline?: string }) {
  return (
    <header className="adm-page-head">
      <div>
        {overline && <p className="adm-overline">{overline}</p>}
        <h1 className="adm-page-title">{title}</h1>
        {subtitle && <p className="t-sub">{subtitle}</p>}
      </div>
      {actions && <div className="adm-page-actions">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  description,
  children,
  actions,
  preview
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  /** endroit du site montré dans l'aperçu quand on travaille dans ce bloc */
  preview?: string;
}) {
  return (
    <section className="adm-card" data-preview={preview} data-preview-label={preview ? title : undefined}>
      {(title || actions) && (
        <div className="adm-card__head">
          <div>
            {title && <h2 className="adm-card__title">{title}</h2>}
            {description && <p className="adm-card__desc">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  return <div className={`adm-grid adm-grid--${cols}`}>{children}</div>;
}

/* =====================================================================
   Champs
   ===================================================================== */
export function TextField({
  label,
  hint,
  value,
  onChange,
  ...rest
}: { label: string; hint?: string; value: string | number | undefined; onChange: (v: string) => void } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />
      {hint && <p className="adm-hint">{hint}</p>}
    </div>
  );
}

/** Zone de texte qui grandit avec son contenu (pas de poignée, pas de barre de défilement). */
export function AutoTextarea({ value, ...rest }: { value: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} value={value} {...rest} />;
}

export function TextArea({
  label,
  hint,
  value,
  onChange,
  rows = 4,
  ...rest
}: { label: string; hint?: string; value: string | undefined; onChange: (v: string) => void } & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <AutoTextarea id={id} className="input" rows={Math.min(rows, 2)} value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />
      {hint && <p className="adm-hint">{hint}</p>}
    </div>
  );
}

export function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return <TextField label={label} type="number" value={value} onChange={(v) => onChange(Number(v) || 0)} />;
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="adm-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="adm-toggle__track" aria-hidden="true" />
      <span>
        <span className="adm-toggle__label">{label}</span>
        {hint && <span className="adm-hint">{hint}</span>}
      </span>
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* =====================================================================
   Listes
   ===================================================================== */
function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/** Liste de tags (Entrée pour ajouter, croix pour retirer, glisser pour réordonner). */
export function TagsField({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const dragFrom = useRef<number | null>(null);
  const add = () => {
    const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))]);
    setInput("");
  };
  return (
    <div className="field">
      <label>{label}</label>
      <div className="adm-tags">
        {value.map((tag, i) => (
          <span
            key={tag + i}
            className="tag adm-tag"
            draggable
            onDragStart={() => (dragFrom.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragFrom.current !== null) onChange(move(value, dragFrom.current, i));
              dragFrom.current = null;
            }}
          >
            {tag}
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Retirer ${tag}`}>
              <Icon name="x" />
            </button>
          </span>
        ))}
        <input
          className="adm-tags__input"
          value={input}
          placeholder={placeholder ?? "Ajouter puis Entrée"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !input && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
        />
      </div>
    </div>
  );
}

/** Liste de lignes de texte (paragraphes, puces). */
export function LinesField({ label, value, onChange, multiline = false, addLabel = "Ajouter une ligne" }: { label: string; value: string[]; onChange: (v: string[]) => void; multiline?: boolean; addLabel?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="adm-lines">
        {value.map((line, i) => (
          <div key={i} className="adm-line">
            {multiline ? (
              <AutoTextarea className="input" rows={1} value={line} onChange={(e) => onChange(value.map((l, j) => (j === i ? e.target.value : l)))} />
            ) : (
              <input className="input" value={line} onChange={(e) => onChange(value.map((l, j) => (j === i ? e.target.value : l)))} />
            )}
            <div className="adm-line__tools">
              <IconButton icon="chevron" label="Monter" className="is-up" onClick={() => onChange(move(value, i, i - 1))} disabled={i === 0} />
              <IconButton icon="chevron" label="Descendre" onClick={() => onChange(move(value, i, i + 1))} disabled={i === value.length - 1} />
              <IconButton icon="x" label="Supprimer" onClick={() => onChange(value.filter((_, j) => j !== i))} />
            </div>
          </div>
        ))}
        <button type="button" className="adm-add" onClick={() => onChange([...value, ""])}>
          <Icon name="plus" /> {addLabel}
        </button>
      </div>
    </div>
  );
}

export function IconButton({ icon, label, onClick, disabled, className = "", tone }: { icon: string; label: string; onClick: () => void; disabled?: boolean; className?: string; tone?: "danger" }) {
  return (
    <button type="button" className={`adm-icon-btn ${tone === "danger" ? "is-danger" : ""} ${className}`} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      <Icon name={icon} />
    </button>
  );
}

/** Liste d'objets éditables : cartes repliables, ajout, suppression, réordonnancement. */
export function Repeater<T>({
  items,
  onChange,
  render,
  create,
  itemTitle,
  addLabel = "Ajouter",
  defaultOpen = false,
  itemPreview
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  create: () => T;
  itemTitle: (item: T, index: number) => string;
  addLabel?: string;
  defaultOpen?: boolean;
  /** endroit du site montré dans l'aperçu pour cet élément */
  itemPreview?: (item: T, index: number) => string | undefined;
}) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const confirm = useConfirm();
  const isOpen = (i: number) => open[i] ?? defaultOpen;

  return (
    <div className="adm-repeater">
      {items.map((item, i) => (
        <div
          key={i}
          className={`adm-item ${isOpen(i) ? "is-open" : ""}`}
          data-preview={itemPreview?.(item, i)}
          data-preview-label={itemPreview ? itemTitle(item, i) : undefined}
        >
          <div className="adm-item__head">
            <button type="button" className="adm-item__toggle" onClick={() => setOpen((o) => ({ ...o, [i]: !isOpen(i) }))}>
              <span className="adm-item__num">{String(i + 1).padStart(2, "0")}</span>
              <span className="adm-item__name">{itemTitle(item, i) || "Sans titre"}</span>
              <Icon name="chevron" className="adm-item__chev" />
            </button>
            <div className="adm-item__tools">
              <IconButton icon="chevron" label="Monter" className="is-up" onClick={() => onChange(move(items, i, i - 1))} disabled={i === 0} />
              <IconButton icon="chevron" label="Descendre" onClick={() => onChange(move(items, i, i + 1))} disabled={i === items.length - 1} />
              <IconButton
                icon="x"
                label="Supprimer"
                tone="danger"
                onClick={async () => {
                  if (await confirm({ title: "Supprimer cet élément ?", text: itemTitle(item, i), confirmLabel: "Supprimer", danger: true })) {
                    onChange(items.filter((_, j) => j !== i));
                  }
                }}
              />
            </div>
          </div>
          {isOpen(i) && (
            <div className="adm-item__body">
              {render(item, (patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it))), i)}
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        className="adm-add"
        onClick={() => {
          onChange([...items, create()]);
          setOpen((o) => ({ ...o, [items.length]: true }));
        }}
      >
        <Icon name="plus" /> {addLabel}
      </button>
    </div>
  );
}

/* =====================================================================
   Fichiers
   ===================================================================== */
export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 ** 2).toFixed(1)} Mo`;
}

/** Bouton d'envoi de fichier : renvoie l'URL publique du fichier enregistré. */
export function UploadButton({
  folder,
  accept,
  onUploaded,
  label = "Envoyer un fichier",
  multiple = false
}: {
  folder: string;
  accept?: string;
  onUploaded: (file: { url: string; type: string; name: string }) => void;
  label?: string;
  multiple?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const toast = useToast();
  async function handle(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      setBusy((b) => b + 1);
      try {
        const res = await adminApi.upload(file, folder);
        onUploaded({ url: res.url, type: res.type, name: file.name });
        toast(`${file.name} envoyé`);
      } catch (e) {
        toast(`${file.name} : ${(e as Error).message}`, "error");
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (ref.current) ref.current.value = "";
  }
  return (
    <>
      <input ref={ref} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => handle(e.target.files)} />
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => ref.current?.click()} disabled={busy > 0}>
        <Icon name="download" className="is-upload" /> {busy > 0 ? "Envoi…" : label}
      </button>
    </>
  );
}

/** Champ URL de fichier avec envoi direct. */
export function FileField({ label, value, onChange, folder, accept, hint }: { label: string; value: string | undefined; onChange: (v: string) => void; folder: string; accept?: string; hint?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="adm-filefield">
        <input className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="/uploads/… ou https://…" />
        <UploadButton folder={folder} accept={accept} onUploaded={(f) => onChange(f.url)} label="Envoyer" />
        {value && (
          <a className="btn btn--ghost btn--sm" href={value} target="_blank" rel="noreferrer">
            <Icon name="external" />
          </a>
        )}
      </div>
      {hint && <p className="adm-hint">{hint}</p>}
    </div>
  );
}

/** Avertit avant de quitter la page avec des modifications non enregistrées. */
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}

export function Loading() {
  return (
    <div className="adm-loading">
      <span />
      <span />
      <span />
    </div>
  );
}

/** Zone de dépôt : glisser des fichiers dessus, ou cliquer pour les choisir. */
export function DropZone({
  folder,
  accept,
  onUploaded,
  title = "Déposez vos fichiers ici",
  text = "ou cliquez pour les choisir",
  compact = false
}: {
  folder: string;
  accept?: string;
  onUploaded: (file: { url: string; type: string; name: string }) => void;
  title?: string;
  text?: string;
  compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(0);
  const toast = useToast();
  async function handle(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      setBusy((b) => b + 1);
      try {
        const res = await adminApi.upload(file, folder);
        onUploaded({ url: res.url, type: res.type, name: file.name });
      } catch (e) {
        toast(`${file.name} : ${(e as Error).message}`, "error");
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (ref.current) ref.current.value = "";
  }
  return (
    <button
      type="button"
      className={`adm-drop ${over ? "is-over" : ""} ${busy ? "is-busy" : ""} ${compact ? "adm-drop--compact" : ""}`}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files);
      }}
    >
      <input ref={ref} type="file" hidden multiple accept={accept} onChange={(e) => handle(e.target.files)} />
      <span className="adm-drop__icon">
        <Icon name="upload" />
      </span>
      <strong>{busy ? `Envoi de ${busy} fichier${busy > 1 ? "s" : ""}…` : title}</strong>
      {!busy && <small>{text}</small>}
    </button>
  );
}

/** Teinte d'un statut de projet : « En ligne » en vert, « En cours » en sable, le reste en turquoise. */
export const statusTone = (s: string) => (/ligne/i.test(s) ? "adm-tone--green" : /cours/i.test(s) ? "adm-tone--sand" : "adm-tone--cyan");
