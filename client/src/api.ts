import { useEffect, useState } from "react";

export interface Experience {
  id: string;
  company: string;
  role: string;
  contract: string;
  period: string;
  mode: string;
  summary: string;
  groups: { title: string; bullets: string[] }[];
  env: string[];
  /** logo de l'entreprise (facultatif) */
  logoUrl?: string;
}

export interface Heading {
  overline: string;
  title: string;
  titleSecondLine?: string;
}

export interface Sections {
  heroButtons: { secondary: string; primary: string };
  stack: Heading;
  profile: Heading;
  features: Heading & {
    blocks: { title: string; text: string; visual?: "mails" | "tiles" | "people" | "cert" | "docs" }[];
    messages: { from: string; source: string; text: string }[];
    tiles: { icon: string; value: string; unit: string; label: string }[];
  };
  stats: Heading;
  projects: Heading;
  parcours: Heading;
  formation?: Heading;
  reasons: Heading;
  cta: { title: string; subtitle: string; button: string };
}

export interface Profile {
  _id?: string;
  fullName: string;
  firstName: string;
  title: string;
  location: string;
  phone: string;
  email: string;
  github: string;
  linkedin: string;
  cvUrl: string;
  avatarUrl?: string;
  hero: { titleTop: string; titleBottom: string; subtitle: string };
  summary: string[];
  skills: { category: string; items: string[] }[];
  experiences: Experience[];
  /** formations : une carte « pass » chacune (bloc « Comment je travaille ») ; badge = étiquette de la carte */
  education: { school: string; title: string; period: string; description: string; tags: string[]; badge?: string }[];
  languages: { name: string; level: string }[];
  stats: { value: number; prefix?: string; suffix?: string; label: string }[];
  reasons: { title: string; text: string; icon: string }[];
  sections: Sections;
  /** petits textes du site (clé → texte) ; vide = texte d'origine */
  texts?: Record<string, string>;
  /** fenêtre « À propos de ce site » */
  about?: AboutContent;
  /** sections masquées sur le site (identifiants de l'admin) */
  hiddenSections?: string[];
  /** documents du bloc « Ma candidature » (CV, recommandation, lettre de motivation…) */
  documents?: AppDoc[];
}

/** Un document du bloc « Ma candidature » : un PDF (CV, recommandation…) ou une lettre rédigée sur le site. */
export interface AppDoc {
  id: string;
  kind: "pdf" | "letter";
  /** étiquette courte sur la carte (« CV », « Recommandation »…) */
  label: string;
  title: string;
  /** petite ligne sous le titre (auteur, nombre de pages…) */
  caption: string;
  tone: "cyan" | "green" | "pink" | "sand";
  /** PDF : adresse du fichier */
  file?: string;
  /** lettre : lieu et date, formule d'appel, corps (paragraphes séparés par une ligne vide), formule finale, signature */
  place?: string;
  greeting?: string;
  body?: string;
  closing?: string;
  signature?: string;
}

export interface AboutContent {
  overline: string;
  title: string;
  paragraphs: string[];
  points: { icon: string; text: string }[];
  primary: string;
  secondary: string;
}

export interface ProjectMedia {
  type: "image" | "video";
  src: string;
  caption: string;
  poster?: string;
}

export interface ProjectBadge {
  icon: string;
  value: string;
  label: string;
}

export interface Project {
  _id?: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  role: string;
  year: string;
  status: string;
  stack: string[];
  highlights: string[];
  links: { label: string; url: string }[];
  media: ProjectMedia[];
  /** badges flottants autour de la vitrine (3 max) */
  badges?: ProjectBadge[];
  featured: boolean;
  order?: number;
}

export interface SiteSettings {
  colors: Record<string, string>;
}

export interface MessageInput {
  name: string;
  email: string;
  company?: string;
  message: string;
}

export interface InboxMessage extends MessageInput {
  _id: string;
  read: boolean;
  createdAt: string;
}

export interface UploadedFile {
  url: string;
  size: number;
  folder: string;
  name: string;
  modified: string;
}

export interface Overview {
  projects: number;
  messages: number;
  unread: number;
  uploads: number;
  experiences: number;
  updatedAt?: string;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof Blob) ? { "Content-Type": "application/json" } : {}),
      ...(init.method && init.method !== "GET" ? { "X-Requested-With": "admin" } : {}),
      ...init.headers
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Erreur ${res.status}`, res.status);
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data)
});

/** API publique (site) */
export const api = {
  profile: () => request<Profile>("/api/profile"),
  projects: () => request<Project[]>("/api/projects"),
  settings: () => request<SiteSettings>("/api/settings"),
  sendMessage: (input: MessageInput) => request<{ ok: true }>("/api/messages", json("POST", input))
};

/** API admin (cookie de session) */
export const adminApi = {
  me: () => request<{ email: string }>("/api/auth/me"),
  /** première connexion : faut-il créer le compte ? la clé du lien est-elle bonne ? */
  setupStatus: (key: string) => request<{ needed: boolean; keyValid: boolean; email: string }>(`/api/auth/setup?cle=${encodeURIComponent(key)}`),
  setup: (key: string, email: string, password: string) => request<{ email: string }>("/api/auth/setup", json("POST", { key, email, password })),
  login: (email: string, password: string) => request<{ email: string }>("/api/auth/login", json("POST", { email, password })),
  logout: () => request<{ ok: true }>("/api/auth/logout", json("POST")),
  overview: () => request<Overview>("/api/admin/overview"),
  profile: () => request<Profile>("/api/admin/profile"),
  saveProfile: (p: Profile) => request<Profile>("/api/admin/profile", json("PUT", p)),
  projects: () => request<Project[]>("/api/admin/projects"),
  createProject: (p: Project) => request<Project>("/api/admin/projects", json("POST", p)),
  updateProject: (id: string, p: Project) => request<Project>(`/api/admin/projects/${id}`, json("PUT", p)),
  deleteProject: (id: string) => request<{ ok: true }>(`/api/admin/projects/${id}`, json("DELETE")),
  reorderProjects: (ids: string[]) => request<Project[]>("/api/admin/projects-order", json("PUT", { ids })),
  settings: () => request<SiteSettings>("/api/admin/settings"),
  saveSettings: (s: SiteSettings) => request<SiteSettings>("/api/admin/settings", json("PUT", s)),
  messages: () => request<InboxMessage[]>("/api/admin/messages"),
  markMessage: (id: string, read: boolean) => request<InboxMessage>(`/api/admin/messages/${id}`, json("PATCH", { read })),
  deleteMessage: (id: string) => request<{ ok: true }>(`/api/admin/messages/${id}`, json("DELETE")),
  uploads: () => request<UploadedFile[]>("/api/admin/uploads"),
  deleteUpload: (url: string) => request<{ ok: true }>(`/api/admin/uploads?url=${encodeURIComponent(url)}`, json("DELETE")),
  upload: (file: File, folder: string) =>
    request<{ url: string; size: number; type: string }>(
      `/api/admin/uploads?name=${encodeURIComponent(file.name)}&folder=${encodeURIComponent(folder)}`,
      { method: "POST", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } }
    ),
  account: (data: { currentPassword: string; email?: string; newPassword?: string }) =>
    request<{ email: string }>("/api/admin/account", json("PUT", data)),
  resetContent: () => request<{ ok: true }>("/api/admin/reset-content", json("POST", { confirm: "REINITIALISER" }))
};

export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    loader()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false });
      })
      .catch((e: Error) => {
        if (!cancelled) setState({ error: e.message, loading: false });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { ...state, reload: () => setTick((t) => t + 1), setData: (data: T) => setState({ data, loading: false }) };
}
