import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import ContactForm from "./ContactForm";
import { Icon } from "./Icons";
import { useSite } from "../content";

const ContactContext = createContext<{ open: () => void; close: () => void }>({ open: () => {}, close: () => {} });

export const useContact = () => useContext(ContactContext);

/** Fournit le bouton "Me contacter" partout dans l'app et affiche le formulaire en modale. */
export function ContactProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const { t, profile } = useSite();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  return (
    <ContactContext.Provider value={{ open, close }}>
      {children}
      {isOpen && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="contact-title" onClick={close}>
          <div className="modal__panel" onClick={(e) => e.stopPropagation()} data-edit="textes" data-edit-target="modal:contact" data-edit-label="Fenêtre de contact">
            <button type="button" className="modal__close" onClick={close} aria-label="Fermer">
              <Icon name="x" />
            </button>
            <p className="t-sub">{t("contact.overline")}</p>
            <h2 id="contact-title" className="t-h3">
              {t("contact.title")}
            </h2>
            <div className="modal__direct">
              {profile?.email && (
                <a className="tag" href={`mailto:${profile.email}`}>
                  <Icon name="mail" /> {profile.email}
                </a>
              )}
              {profile?.phone && (
                <a className="tag" href={`tel:${profile.phone.replace(/\s/g, "")}`}>
                  <Icon name="phone" /> {profile.phone}
                </a>
              )}
            </div>
            <ContactForm />
          </div>
        </div>
      )}
    </ContactContext.Provider>
  );
}
