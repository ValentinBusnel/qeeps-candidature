import mongoose from "mongoose";

let connected = false;

export async function connectDb(uri: string): Promise<boolean> {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    connected = true;
    console.log(`✅ MongoDB connecté (${mongoose.connection.name})`);
  } catch (err) {
    connected = false;
    console.warn(
      "⚠️  MongoDB injoignable — l'API sert les données de seed en mémoire.\n" +
        "    Lance `npm run db:up` (Docker) ou renseigne MONGODB_URI dans server/.env."
    );
  }
  return connected;
}

export const isDbConnected = () => connected && mongoose.connection.readyState === 1;
