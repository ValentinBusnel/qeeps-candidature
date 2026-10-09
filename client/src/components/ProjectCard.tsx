import type { Project } from "../api";
import { Icon } from "./Icons";

/** Carte projet secondaire (les projets mis en avant ont leur propre bloc). */
export default function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  return (
    <article className="project-card is-clickable">
      <button type="button" className="showcase__hit" onClick={onOpen} aria-label={`Voir le projet ${project.title}`} />
      <div className="project-card__top">
        <span className="tag tag--cyan">{project.status}</span>
        <span className="t-sub">{project.year}</span>
      </div>
      <h3 className="t-h3">{project.title}</h3>
      <p className="t-lead">{project.description}</p>
      <ul className="checklist">
        {project.highlights.map((h) => (
          <li key={h}>
            <Icon name="check" />
            {h}
          </li>
        ))}
      </ul>
      <div className="project-card__stack">
        {project.stack.map((s) => (
          <span key={s} className="tag">
            {s}
          </span>
        ))}
      </div>
      <span className="project-card__open">
        Voir le projet <Icon name="arrow" />
      </span>
    </article>
  );
}
