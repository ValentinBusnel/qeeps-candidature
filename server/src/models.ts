import { Schema, model } from "mongoose";
import type { ProfileData, ProjectData, SettingsData } from "./data/seed-data.js";

// Le profil et les projets suivent les interfaces de seed-data.ts ;
// `strict: false` permet de faire évoluer le contenu sans migration.
const profileSchema = new Schema<ProfileData>(
  { seedVersion: Number, fullName: { type: String, required: true } },
  { strict: false, timestamps: true, minimize: false }
);

const projectSchema = new Schema<ProjectData>(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    order: { type: Number, default: 0 }
  },
  { strict: false, timestamps: true, minimize: false }
);

const settingsSchema = new Schema<SettingsData>(
  {
    colors: { type: Schema.Types.Mixed, default: {} },
    migrations: { type: [String], default: [] },
    stackLogos: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, minimize: false }
);

export interface MessageData {
  name: string;
  email: string;
  company?: string;
  message: string;
  read: boolean;
}

const messageSchema = new Schema<MessageData>(
  {
    name: { type: String, required: true, maxlength: 120 },
    email: { type: String, required: true, maxlength: 200 },
    company: { type: String, maxlength: 120 },
    message: { type: String, required: true, maxlength: 3000 },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export type UserRole = "admin" | "viewer";

export interface UserData {
  email: string;
  /** vide tant que la personne invitée n'a pas choisi son mot de passe */
  passwordHash: string;
  /** admin : peut tout modifier ; viewer : lecture seule */
  role: UserRole;
  sessionVersion: number;
  /** invitation / lien de mot de passe : seule l'empreinte SHA-256 du jeton est stockée */
  inviteTokenHash?: string;
  inviteExpires?: Date;
}

const userSchema = new Schema<UserData>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: "" },
    role: { type: String, enum: ["admin", "viewer"], default: "admin" },
    sessionVersion: { type: Number, default: 1 },
    inviteTokenHash: { type: String, index: true, sparse: true },
    inviteExpires: { type: Date }
  },
  { timestamps: true }
);

export const Profile = model<ProfileData>("Profile", profileSchema);
export const Project = model<ProjectData>("Project", projectSchema);
export const Settings = model<SettingsData>("Settings", settingsSchema);
export const Message = model<MessageData>("Message", messageSchema);
export const User = model<UserData>("User", userSchema);
