import { createContext, FormEvent, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../api";
import { Icon } from "./Icons";
import { useContact } from "./ContactModal";
import { useSite } from "../content";
import type { AboutContent } from "../api";

type Which = "login" | "about" | null;
const SiteModalsContext = createContext<{
  openLogin: () => void;
  openAbout: () => void;
  /** ouvre une fenêtre sans condition (aperçu de l'admin) ou ferme tout */
  show: (which: "login" | "about" | null) => void;
  loggedIn: boolean;
}>({
  openLogin: () => {},
  openAbout: () => {},
  show: () => {},
  loggedIn: false
});

export const useSiteModals = () => useContext(SiteModalsContext);

/** Modales du site public : connexion à l'espace admin et « À propos de ce site ». */
export function SiteModalsProvider({ children }: { children: ReactNode }) {
  const [which, setWhich] = useState<Which>(null);
  const navigate = useNavigate();
  const close = useCallback(() => setWhich(null), []);
  // session admin en cours ? (le bouton de la barre devient « Modifier mon site »)
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    adminApi
      .me()
      .then(() => setLoggedIn(true))
      .catch(() => setLoggedIn(false));
  }, []);

  // déjà connecté : on file directement dans l'admin, sinon on ouvre la connexion
  const openLogin = useCallback(() => {
    adminApi
      .me()
      .then(() => navigate("/admin"))
      .catch(() => setWhich("login"));
  }, [navigate]);
  const openAbout = useCallback(() => setWhich("about"), []);

  useEffect(() => {
    if (!which) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [which, close]);

  return (
    <SiteModalsContext.Provider value={{ openLogin, openAbout, show: setWhich, loggedIn }}>
      {children}
      {which && (
        <div className="modal" role="dialog" aria-modal="true" onClick={close}>
          <div
            className={`modal__panel ${which === "about" ? "modal__panel--about" : "modal__panel--login"}`}
            onClick={(e) => e.stopPropagation()}
            data-edit={which === "about" ? "apropos" : "textes"}
            data-edit-target={which === "about" ? "modal:about" : "modal:login"}
            data-edit-label={which === "about" ? "Fenêtre « À propos »" : "Fenêtre de connexion"}
          >
            <button type="button" className="modal__close" onClick={close} aria-label="Fermer">
              <Icon name="x" />
            </button>
            {which === "login" ? <LoginForm onDone={() => navigate("/admin")} /> : <About onClose={close} />}
          </div>
        </div>
      )}
    </SiteModalsContext.Provider>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const { t } = useSite();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await adminApi.login(String(data.get("email")), String(data.get("password")));
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="site-login" onSubmit={onSubmit}>
      <span className="site-modal__icon" aria-hidden="true">
        <Icon name="lock" />
      </span>
      <div>
        <h2 className="t-h3">{t("login.title")}</h2>
        <p className="t-sub">{t("login.sub")}</p>
      </div>
      <div className="field">
        <label htmlFor="site-login-email">{t("login.email")}</label>
        <input id="site-login-email" name="email" type="email" className="input" autoComplete="username" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="site-login-password">{t("login.password")}</label>
        <input id="site-login-password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      {error && <p className="contact-form__error">{error}</p>}
      <button className="btn btn--primary" disabled={busy}>
        <Icon name="arrow" /> {busy ? "…" : t("login.submit")}
      </button>
    </form>
  );
}

/** Contenu d'origine de la fenêtre « À propos » (modifiable dans l'admin). */
export const ABOUT_DEFAULT: AboutContent = {
  overline: "À propos de ce site",
  title: "Un site créé pour une seule candidature",
  paragraphs: [
    "J'ai conçu et développé ce site uniquement pour ma candidature chez Qeeps. Plutôt qu'un CV de plus, j'ai voulu vous montrer concrètement comment je travaille.",
    "Il reprend volontairement l'identité de byqeeps.com : typographies, couleurs, espacements et animations, pour prouver que je peux m'intégrer à votre produit dès le premier jour. Il n'est ni affilié à Qeeps ni validé par l'équipe."
  ],
  points: [
    { icon: "code", text: "Fait main de A à Z : React, TypeScript, Node.js, Express et MongoDB, avec un back-office complet." },
    { icon: "clock", text: "Temporaire : il sera mis hors ligne à la fin du processus de recrutement, quelle qu'en soit l'issue." },
    { icon: "mail", text: "Les messages envoyés depuis le formulaire servent uniquement à me contacter et seront supprimés avec le site." }
  ],
  primary: "Me contacter",
  secondary: "Fermer"
};

function About({ onClose }: { onClose: () => void }) {
  const { open } = useContact();
  const { profile } = useSite();
  const a = { ...ABOUT_DEFAULT, ...profile?.about };
  return (
    <div className="site-about">
      <span className="site-modal__icon" aria-hidden="true">
        <Icon name="info" />
      </span>
      {a.overline && <p className="t-overline">{a.overline}</p>}
      <h2 className="t-h3">{a.title}</h2>
      {a.paragraphs.filter(Boolean).map((p, i) => (
        <p key={i} className="t-body">
          {p}
        </p>
      ))}
      {a.points.length > 0 && (
        <ul className="site-about__points">
          {a.points.map((pt, i) => (
            <li key={i}>
              <Icon name={pt.icon} /> {pt.text}
            </li>
          ))}
        </ul>
      )}
      <div className="site-about__actions">
        {a.primary && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onClose();
              open();
            }}
          >
            <Icon name="send" /> {a.primary}
          </button>
        )}
        {a.secondary && (
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            {a.secondary}
          </button>
        )}
      </div>
    </div>
  );
}
