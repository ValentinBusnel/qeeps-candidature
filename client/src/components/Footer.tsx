import { Icon } from "./Icons";
import { Wordmark } from "./Navbar";
import { useContact } from "./ContactModal";
import { useSiteModals } from "./SiteModals";
import { useSite } from "../content";

export default function Footer() {
  const { open } = useContact();
  const { openAbout } = useSiteModals();
  const { t, profile } = useSite();
  return (
    <footer className="footer" id="footer" data-edit="textes" data-edit-target="footer" data-edit-label="Pied de page">
      <div className="footer__inner">
        <div className="footer__brand">
          <Wordmark light />
          <p>{t("footer.text")}</p>
          <div className="footer__socials">
            {profile?.email && (
              <a href={`mailto:${profile.email}`} aria-label="Email">
                <Icon name="mail" />
              </a>
            )}
            {profile?.phone && (
              <a href={`tel:${profile.phone.replace(/\s/g, "")}`} aria-label="Téléphone">
                <Icon name="phone" />
              </a>
            )}
            {profile?.linkedin && (
              <a href={profile.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn">
                <Icon name="linkedin" />
              </a>
            )}
            {profile?.github && (
              <a href={profile.github} target="_blank" rel="noreferrer" aria-label="GitHub">
                <Icon name="github" />
              </a>
            )}
          </div>
        </div>
        <div className="footer__cols">
          <div className="footer__col">
            <p className="footer__title">{t("footer.title")}</p>
            <button type="button" onClick={openAbout}>
              {t("footer.about")}
            </button>
            <button type="button" onClick={open}>
              {t("footer.contact")}
            </button>
            {!profile?.hiddenSections?.includes("experiences") && <a href="/#parcours">{t("footer.parcours")}</a>}
          </div>
        </div>
      </div>
      <p className="footer__legal">
        © {new Date().getFullYear()}{profile?.fullName ? ` – ${profile.fullName}` : ""} | {t("footer.legal")}
      </p>
    </footer>
  );
}
