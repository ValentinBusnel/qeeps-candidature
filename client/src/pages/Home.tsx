import { useEffect, useRef, useState, type CSSProperties } from "react";
import { api, useAsync, type Profile, type Project, type Sections } from "../api";
import { Icon } from "../components/Icons";
import { Marquee, Reveal, useTilt } from "../components/motion";
import SectionHeading from "../components/SectionHeading";
import StackLogo from "../components/StackLogo";
import AdminMockup from "../components/home/AdminMockup";
import FeatureBlocks from "../components/home/FeatureBlocks";
import ProjectModal from "../components/project/ProjectModal";
import ProjectSwitcher from "../components/project/ProjectSwitcher";
import ExperienceSwitcher from "../components/home/ExperienceSwitcher";
import { useContact } from "../components/ContactModal";
import { useSiteModals } from "../components/SiteModals";
import { useSite } from "../content";
import "./home.css";

const emptyHeading = { overline: "", title: "" };
/** Valeurs de secours si une section manque dans la base. */
const profileDefaults: Sections = {
  heroButtons: { secondary: "À propos de ce site", primary: "Me contacter" },
  stack: emptyHeading,
  profile: emptyHeading,
  features: { ...emptyHeading, blocks: [], messages: [], tiles: [] },
  stats: emptyHeading,
  projects: emptyHeading,
  parcours: emptyHeading,
  formation: { overline: "Formation", title: "Comment j'ai appris" },
  reasons: emptyHeading,
  cta: { title: "Pas encore convaincu ?", subtitle: "", button: "Me contacter" }
};

/**
 * Mode aperçu (/?apercu=1 dans l'admin) : la page affiche le brouillon reçu de l'admin
 * à chaque frappe et se place sur la section en cours de modification.
 */
const PREVIEW = typeof window !== "undefined" && window.parent !== window && new URLSearchParams(location.search).has("apercu");

function usePreviewBridge(setProfile: (p: Profile) => void, loaded: boolean) {
  const setRef = useRef(setProfile);
  setRef.current = setProfile;
  useEffect(() => {
    if (!PREVIEW || !loaded) return;
    document.documentElement.classList.add("is-preview");
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      if (e.data?.type === "qeeps:draft") setRef.current(e.data.profile as Profile);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "qeeps:ready" }, location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, [loaded]);
}

export default function Home() {
  const profile = useAsync(api.profile);
  const projects = useAsync(api.projects);
  const { openAbout } = useSiteModals();
  const { open } = useContact();
  const [openProject, setOpenProject] = useState<{ project: Project; index: number; origin?: DOMRect | null } | null>(null);
  const profileTilt = useTilt<HTMLDivElement>();
  const { t } = useSite();
  usePreviewBridge(profile.setData, !profile.loading);

  if (profile.loading) return <div className="state">{t("state.loading")}</div>;
  if (profile.error || !profile.data)
    return (
      <div className="state">
        Impossible de charger le dossier ({profile.error}). Vérifie que l'API tourne sur le port 4000.
      </div>
    );

  const p = profile.data;
  const allProjects = projects.data ?? [];
  const stack = p.skills.flatMap((s) => s.items);
  const sec = { ...profileDefaults, ...p.sections };
  const hidden = p.hiddenSections ?? [];
  const show = (id: string) => !hidden.includes(id);

  return (
    <>
      {/* ---------- Hero (apparitions Framer relevées sur byqeeps.com) ---------- */}
      <section className="hero" id="accueil" data-edit="accueil" data-edit-label="Haut de page">
        <div
          className="hero__mock appear"
          style={{ "--appear-y": "70px", "--appear-d": "1.6s", "--appear-delay": "0.3s", "--appear-ease": "var(--ease-hero)" } as CSSProperties}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            e.currentTarget.style.setProperty("--tilt-x", `${(-y * 1.2).toFixed(2)}deg`);
            e.currentTarget.style.setProperty("--tilt-y", `${(x * 1.2).toFixed(2)}deg`);
            e.currentTarget.style.setProperty("--tilt-s", "1.01");
          }}
          onMouseLeave={(e) => {
            ["--tilt-x", "--tilt-y", "--tilt-s"].forEach((v) => e.currentTarget.style.removeProperty(v));
          }}
        >
          {/* ≤ 1199 px : la maquette garde son gabarit desktop et est réduite (comme byqeeps.com) */}
          <div className="hero__scale">
            <div className="hero__tilt">
              <AdminMockup />
            </div>
          </div>
        </div>
        <div className="hero__blur" aria-hidden="true" />
        <div className="hero__content">
          <h1 id="hero-title" className="t-h1 hero__title appear" style={{ "--appear-y": "20px" } as CSSProperties}>
            <span className="t-gradient">{p.hero.titleTop}</span>
            <br />
            <span className="t-gradient">{p.hero.titleBottom}</span>
          </h1>
          <p className="t-sub hero__sub appear" style={{ "--appear-y": "20px" } as CSSProperties}>
            {p.hero.subtitle}
          </p>
          <div
            id="hero-actions"
            className="hero__actions appear"
            style={{ "--appear-y": "50px", "--appear-d": "1s", "--appear-delay": "0.2s" } as CSSProperties}
          >
            <button type="button" className="btn btn--secondary" onClick={openAbout}>
              <Icon name="info" /> {sec.heroButtons.secondary}
            </button>
            <button type="button" className="btn btn--primary" onClick={open}>
              <Icon name="send" /> {sec.heroButtons.primary}
            </button>
          </div>
        </div>
      </section>

      {/* ---------- Stack (défilé de logos) ---------- */}
      {show("stack") && (
      <section className="section section--stack" id="stack" data-edit="stack" data-edit-label="Stack technique">
        <SectionHeading {...sec.stack} tight />
        <div className="ticker">
          {/* Qeeps défile à 25 px/s ; ici deux fois plus vite (80 px/s) pour voir toute la stack rapidement */}
          <Marquee speed={80} fade={30}>
            {stack.map((tech) => (
              <StackLogo key={tech} name={tech} />
            ))}
          </Marquee>
        </div>
      </section>
      )}

      {/* ---------- Profil ---------- */}
      {show("profil") && (
      <section className="section" id="profil" data-edit="profil" data-edit-label="Qui suis-je ?">
        <SectionHeading {...sec.profile} />
        <div className="narrow">
          <div className="profile">
            <div id="profil-card" className="profile__card card" ref={profileTilt.ref} onMouseMove={profileTilt.onMouseMove} onMouseLeave={profileTilt.onMouseLeave}>
              <span className="tilt-glare" aria-hidden="true" />
              <div className="profile__head">
                {p.avatarUrl ? (
                  <img className="profile__avatar" src={p.avatarUrl} alt={p.fullName} width={49} height={49} />
                ) : (
                  <span className="profile__avatar">{p.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                )}
                <p className="profile__name">{p.fullName}</p>
              </div>
              <p className="profile__title">{p.title}</p>
              <ul className="profile__facts">
                <li><Icon name="pin" /> {p.location}</li>
                <li><Icon name="phone" /> <a href={`tel:${p.phone.replace(/\s/g, "")}`}>{p.phone}</a></li>
                <li><Icon name="mail" /> <a href={`mailto:${p.email}`}>{p.email}</a></li>
              </ul>
              <div className="profile__links">
                {p.linkedin && (
                  <a className="btn btn--secondary btn--sm" href={p.linkedin} target="_blank" rel="noreferrer">
                    <Icon name="linkedin" /> LinkedIn
                  </a>
                )}
                {p.github && (
                  <a className="btn btn--secondary btn--sm" href={p.github} target="_blank" rel="noreferrer">
                    <Icon name="github" /> GitHub
                  </a>
                )}
                {p.cvUrl && (
                  <a className="btn btn--primary btn--sm" href={p.cvUrl} target="_blank" rel="noreferrer">
                    <Icon name="download" /> CV
                  </a>
                )}
              </div>
            </div>
            <div id="profil-text" className="profile__text">
              {p.summary.map((para, i) => (
                <p key={i} className={i === 0 ? "t-lead profile__intro" : "t-body"}>
                  {para}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ---------- Expériences (frise à faire glisser) ---------- */}
      {show("experiences") && (
      <section className="section" id="parcours" data-edit="experiences" data-edit-label="Expériences">
        <SectionHeading {...sec.parcours} />
        <div className="container">
          <ExperienceSwitcher experiences={p.experiences} />
        </div>
      </section>
      )}

      {/* ---------- Blocs fonctionnalités ---------- */}
      {show("methode") && (
      <section className="section section--features" id="methode" data-edit="methode" data-edit-label="Comment je travaille">
        <SectionHeading {...sec.features} />
        <div className="narrow">
          <FeatureBlocks profile={p} />
        </div>
      </section>
      )}

      {/* ---------- Chiffres (apparition relevée sur byqeeps.com : +20 px, 0,8 s, décalées de 0,2 s) ---------- */}
      {show("chiffres") && (
      <section className="section section--stats" id="chiffres" data-edit="chiffres" data-edit-label="Chiffres">
        <SectionHeading {...sec.stats} gap={96} />
        <div className="stats">
          {p.stats.map((s, i) => (
            <Reveal
              key={s.label}
              className="stats__item"
              delay={(i + 1) * 200}
              threshold={0.5}
              style={{ "--reveal-d": "0.8s", "--reveal-ease": "cubic-bezier(0.12, 0.23, 0.32, 0.99)" } as CSSProperties}
            >
              <p className="t-stat t-gradient stats__value">
                {s.prefix}
                {s.value}
                {s.suffix}
              </p>
              <p className="stats__label">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>
      )}

      {/* ---------- Projets ---------- */}
      {show("projets") && (
      <section className="section" id="projets" data-edit="projets" data-edit-label="Projets">
        <SectionHeading {...sec.projects} />
        <div className="container projects">
          <ProjectSwitcher projects={allProjects} onOpen={(project, index, origin) => setOpenProject({ project, index, origin })} />
        </div>
      </section>
      )}

      {/* ---------- Pourquoi Qeeps (carrousel) ---------- */}
      {show("atouts") && (
      <section className="section section--reasons" id="atouts" data-edit="atouts" data-edit-label="Ce que j'apporte">
        <SectionHeading {...sec.reasons} tight />
        <div className="ticker ticker--cards">
          <Marquee speed={25} fade={15} className="reasons">
            {p.reasons.map((r) => (
              <article key={r.title} className="reason">
                <div className="reason__head">
                  <span className="reason__icon"><Icon name={r.icon} /></span>
                  <div>
                    <p className="reason__title">{r.title}</p>
                    <p className="reason__by">{t("reasons.by")}</p>
                  </div>
                </div>
                <p className="reason__text">{r.text}</p>
              </article>
            ))}
          </Marquee>
        </div>
      </section>
      )}

      {openProject && (
        <ProjectModal
          project={openProject.project}
          projects={allProjects}
          startIndex={openProject.index}
          origin={openProject.origin}
          onNavigate={(project) => setOpenProject({ project, index: 0, origin: null })}
          onClose={() => setOpenProject(null)}
        />
      )}

      {/* ---------- CTA ---------- */}
      {show("contact") && (
      <section className="cta" id="contact" data-edit="contact" data-edit-label="Contact">
        <div className="cta__inner">
          <h2 className="t-h2">{sec.cta.title}</h2>
          <p className="t-overline">{sec.cta.subtitle}</p>
          <button type="button" className="btn btn--primary" onClick={open}>
            <Icon name="send" /> {sec.cta.button}
          </button>
        </div>
      </section>
      )}
    </>
  );
}
