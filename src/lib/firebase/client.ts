// src/lib/firebase/client.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Firebase WEB app configuration. These NEXT_PUBLIC_* values are intentionally
// browser-visible (they identify the project; they are not credentials).
// Firebase Admin credentials are server-only and never belong here. Each value
// is read with a literal `process.env.NEXT_PUBLIC_*` access so Next.js can
// inline it into the client bundle at build/dev-start time.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Fail early with an actionable message instead of Firebase's opaque
// `auth/invalid-api-key` (which the SDK raises when apiKey is empty or contains
// ':'). Only variable NAMES are reported, never values.
const REQUIRED_WEB_CONFIG: ReadonlyArray<readonly [keyof typeof firebaseConfig, string]> = [
  ["apiKey", "NEXT_PUBLIC_FIREBASE_API_KEY"],
  ["authDomain", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"],
  ["projectId", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"],
  ["appId", "NEXT_PUBLIC_FIREBASE_APP_ID"],
];

const invalidWebConfig = REQUIRED_WEB_CONFIG.filter(([field]) => {
  const value = firebaseConfig[field];
  return !value || (field === "apiKey" && value.includes(":"));
}).map(([, envName]) => envName);

if (invalidWebConfig.length > 0) {
  throw new Error(
    `Firebase web configuration is missing or malformed: ${invalidWebConfig.join(", ")}. ` +
      "Set these from the Firebase console Web App config, then restart the Next.js dev server " +
      "(or rebuild) so the values are inlined."
  );
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export { app, auth };

export const storage = getStorage(app);
