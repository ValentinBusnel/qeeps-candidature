import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Icon } from "./Icons";
import { useContact } from "./ContactModal";
import { useSiteModals } from "./SiteModals";
import { useSite } from "../content";

const links = [
  { href: "#profil", key: "nav.profil", section: "profil" },
  { href: "#projets", key: "nav.projets", section: "projets" },
  { href: "#parcours", key: "nav.parcours", section: "experiences" }
] as const;

export function Wordmark({ light = false }: { light?: boolean }) {
  const { t } = useSite();
  return (
    <span className={`wordmark ${light ? "wordmark--light" : ""}`}>
      {t("brand")}
      <span className="wordmark__dot">.</span>
    </span>
  );
}

export default function Navbar() {
  const { pathname } = useLocation();
  const onHome = pathname === "/";
  const { open } = useContact();
  const { openLogin, loggedIn } = useSiteModals();
  const { t, profile } = useSite();
  const hidden = profile?.hiddenSections ?? [];
  const [active, setActive] = useState("#profil");
  // menu « burger » (≤ 1199 px, comme byqeeps.com)
  const [menuOpen, setMenuOpen] = useState(false);
  // comme byqeeps.com : le menu se déroule par-dessus la page, sans la bloquer ;
  // il se referme au défilement ou au clic en dehors
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const y0 = window.scrollY;
    const onScroll = () => Math.abs(window.scrollY - y0) > 40 && setMenuOpen(false);
    const onDown = (e: PointerEvent) => !navRef.current?.contains(e.target as Node) && setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
  const closeMenu = () => setMenuOpen(false);

  // Souligne le lien de la section visible, comme l'onglet actif de Qeeps
  useEffect(() => {
    if (!onHome) return;
    const sections = links
      .map((l) => document.querySelector(l.href))
      .filter((el): el is Element => el !== null);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => e.isIntersecting && setActive(`#${e.target.id}`));
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [onHome]);

  return (
    <header ref={navRef} className={`nav ${menuOpen ? "nav--open" : ""}`} data-edit="textes" data-edit-target="nav" data-edit-label="Barre de navigation">
      <div className="nav__inner">
        <div className="nav__left">
          <Link to="/" aria-label="Accueil">
            <Wordmark />
          </Link>
          <nav className="nav__links" aria-label="Navigation principale">
            {links.filter((l) => !hidden.includes(l.section)).map((l) => (
              <a
                key={l.href}
                onClick={closeMenu}
                href={onHome ? l.href : `/${l.href}`}
                className={`nav__link ${onHome && active === l.href ? "is-active" : ""}`}
              >
                {t(l.key)}
              </a>
            ))}
          </nav>
        </div>
        <div className="nav__right">
          {loggedIn ? (
            <Link to="/admin" className="btn btn--secondary nav__brand-btn" onClick={closeMenu}>
              <Icon name="gear" />
              <span>{t("nav.edit")}</span>
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn--secondary nav__brand-btn"
              onClick={() => {
                closeMenu();
                openLogin();
              }}
            >
              <Icon name="lock" />
              <span>{t("nav.login")}</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              closeMenu();
              open();
            }}
          >
            <Icon name="send" />
            <span>{t("nav.contact")}</span>
          </button>
        </div>
        {/* bouton menu (≤ 1199 px) : deux traits gris 20 × 2 qui se croisent à l'ouverture */}
        <button
          type="button"
          className="nav__burger"
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <i />
          <i />
        </button>
      </div>
    </header>
  );
}
