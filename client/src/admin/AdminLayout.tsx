import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { adminApi } from "../api";
import { Icon } from "../components/Icons";
import { useAuth } from "./AuthContext";
import { ProfileDraftProvider, useProfileDraft } from "./ProfileDraft";
import { useConfirm } from "./ui";
import "./admin.css";

/** Cinq espaces, pas plus : tout le reste se trouve dans le menu du compte. */
const SPACES = [
  { to: "/admin", label: "Accueil", icon: "home", end: true },
  { to: "/admin/contenu", label: "Mon site", icon: "edit" },
  { to: "/admin/projets", label: "Projets", icon: "image" },
  { to: "/admin/messages", label: "Messages", icon: "mail" },
  { to: "/admin/medias", label: "Fichiers", icon: "layers" }
];

/** Pastille flottante : apparaît dès qu'une modification attend d'être publiée. */
function PublishBar() {
  const { dirty, saving, save, discard } = useProfileDraft();
  const confirm = useConfirm();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && dirty) {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, save]);

  return (
    <div className={`adm-publish ${dirty ? "is-visible" : ""}`} aria-hidden={!dirty}>
      <p>
        <span className="adm-publish__dot" /> Modifications non publiées
      </p>
      <button
        type="button"
        className="adm-publish__undo"
        tabIndex={dirty ? 0 : -1}
        onClick={async () => {
          if (await confirm({ title: "Annuler les modifications ?", text: "Tout ce qui n'a pas été publié sera perdu.", confirmLabel: "Tout annuler", danger: true })) discard();
        }}
      >
        Annuler
      </button>
      <button type="button" className="btn btn--primary btn--sm adm-publish__go" onClick={save} disabled={saving} tabIndex={dirty ? 0 : -1}>
        <Icon name="send" /> {saving ? "Publication…" : "Publier"}
        <kbd>⌘S</kbd>
      </button>
    </div>
  );
}

/** « Voir le site » : même onglet ; prévient s'il reste des modifications non publiées. */
export function SiteLink({ className, children, role }: { className?: string; children: ReactNode; role?: string }) {
  const { dirty } = useProfileDraft();
  const confirm = useConfirm();
  const navigate = useNavigate();
  return (
    <Link
      to="/"
      role={role}
      className={className}
      onClick={async (e) => {
        if (!dirty) return;
        e.preventDefault();
        if (await confirm({ title: "Quitter sans publier ?", text: "Vos modifications non publiées seront perdues.", confirmLabel: "Quitter", danger: true })) navigate("/");
      }}
    >
      {children}
    </Link>
  );
}

function AccountMenu() {
  const { email, logout, readOnly } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`adm-account ${open ? "is-open" : ""}`} ref={ref}>
      <button type="button" className="adm-account__btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Mon compte">
        <span className="adm-avatar">{email?.[0]?.toUpperCase()}</span>
        <Icon name="chevron" />
      </button>
      <div className="adm-account__menu" role="menu">
        <p className="adm-account__who">
          <small>Connecté en tant que</small>
          {email}
          <small className="adm-account__role">{readOnly ? "Lecture seule" : "Administrateur"}</small>
        </p>
        {!readOnly && (
          <Link to="/admin/utilisateurs" role="menuitem">
            <Icon name="users" /> Utilisateurs
          </Link>
        )}
        <Link to="/admin/apparence" role="menuitem">
          <Icon name="palette" /> Couleurs du site
        </Link>
        <Link to="/admin/compte" role="menuitem">
          <Icon name="lock" /> Identifiants
        </Link>
        <SiteLink role="menuitem" className="adm-account__site">
          <Icon name="eye" /> Voir le site
        </SiteLink>
        <button
          type="button"
          role="menuitem"
          onClick={async () => {
            await logout();
            navigate("/admin/connexion");
          }}
        >
          <Icon name="logout" /> Se déconnecter
        </button>
      </div>
    </div>
  );
}

/** Navigation en pilule : un indicateur blanc glisse sous l'espace actif. */
function Spaces({ unread }: { unread: number }) {
  const { pathname } = useLocation();
  const nav = useRef<HTMLElement>(null);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const a = nav.current?.querySelector<HTMLElement>(".adm-spaces__link.active");
      setInd(a ? { left: a.offsetLeft, width: a.offsetWidth } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname]);

  return (
    <nav className="adm-spaces" ref={nav} aria-label="Espaces">
      {ind && <span className="adm-spaces__ind" style={{ left: ind.left, width: ind.width }} aria-hidden="true" />}
      {SPACES.map((s) => (
        <NavLink key={s.to} to={s.to} end={s.end} className="adm-spaces__link">
          <Icon name={s.icon} />
          <span>{s.label}</span>
          {s.to === "/admin/messages" && unread > 0 && <span className="adm-badge">{unread}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

/** Boutons qui ne modifient rien (navigation, ouverture, aperçu) : restent actifs en lecture seule. */
const RO_ALLOWED =
  ".adm-msg, .adm-reader__back, .adm-row, .adm-file, .adm-item__toggle, .adm-plist__main, .adm-sec-nav__btn, .adm-preview-toggle, .adm-preview__devices button, [data-ro-allow] *";

/**
 * Lecture seule : tous les champs et boutons d'action de la page sont désactivés,
 * y compris ceux qui apparaissent ensuite (le serveur refuse de toute façon les modifications).
 */
function useReadOnly(root: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const el = root.current;
    if (!on || !el) return;
    const lock = () => {
      el.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, textarea, select, button").forEach((c) => {
        if (!c.disabled && !c.matches(RO_ALLOWED)) c.disabled = true;
      });
    };
    lock();
    const obs = new MutationObserver(lock);
    obs.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled"] });
    return () => obs.disconnect();
  }, [root, on]);
}

export default function AdminLayout() {
  const { pathname } = useLocation();
  const { readOnly } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    adminApi.overview().then((o) => setUnread(o.unread)).catch(() => {});
  }, [pathname]);
  // chaque page démarre en haut (seul le contenu défile, pas la fenêtre)
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);
  useReadOnly(mainRef, readOnly);

  // l'éditeur de contenu prend toute la largeur (aperçu en direct à droite)
  const wide = pathname.startsWith("/admin/contenu");
  // pages en volets : elles tiennent dans l'écran, seules leurs listes défilent si besoin
  const fit = ["/admin", "/admin/projets", "/admin/medias"].includes(pathname.replace(/\/$/, ""));

  return (
    <ProfileDraftProvider>
      <div
        className={`adm ${wide ? "adm--wide" : ""} ${fit ? "adm--fit" : ""} ${readOnly ? "adm--readonly" : ""}`}
        onMouseDown={(e) => {
          // un clic n'importe où dans une fiche place le curseur dans son champ
          const t = e.target as HTMLElement;
          if (!t.classList.contains("field")) return;
          const input = t.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select");
          if (input) {
            e.preventDefault();
            input.focus();
          }
        }}
      >
        <header className="adm-top">
          <Link to="/admin" className="adm-logo" aria-label="Accueil de l'administration">
            Valentin<span>.</span>
          </Link>
          <Spaces unread={unread} />
          <div className="adm-top__right">
            {readOnly && (
              <span className="adm-ro-badge" title="Vous pouvez tout consulter, mais rien modifier">
                <Icon name="eye" /> <span>Lecture seule</span>
              </span>
            )}
            <SiteLink className="btn btn--secondary btn--sm adm-top__site">
              <Icon name="eye" /> Voir le site
            </SiteLink>
            <AccountMenu />
          </div>
        </header>
        <main className="adm-main" ref={mainRef}>
          <div className="adm-main__inner" key={pathname.split("/").slice(0, 3).join("/")}>
            <Outlet />
          </div>
        </main>
        {!readOnly && <PublishBar />}
      </div>
    </ProfileDraftProvider>
  );
}
