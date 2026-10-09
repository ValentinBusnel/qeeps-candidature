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
  { colors: { type: Schema.Types.Mixed, default: {} }, migrations: { type: [String], default: [] } },
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

export interface UserData {
  email: string;
  passwordHash: string;
  sessionVersion: number;
}

const userSchema = new Schema<UserData>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    sessionVersion: { type: Number, default: 1 }
  },
  { timestamps: true }
);

export const Profile = model<ProfileData>("Profile", profileSchema);
export const Project = model<ProjectData>("Project", projectSchema);
export const Settings = model<SettingsData>("Settings", settingsSchema);
export const Message = model<MessageData>("Message", messageSchema);
export const User = model<UserData>("User", userSchema);
