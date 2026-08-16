// src/lib/firebase-admin.ts
import admin from "firebase-admin";

function getServiceAccount() {
  const adminKey = process.env.FIREBASE_ADMIN_KEY;
  if (adminKey) {
    try {
      let key = adminKey.trim();
      if (
        (key.startsWith('"') && key.endsWith('"')) ||
        (key.startsWith("'") && key.endsWith("'"))
      ) {
        key = key.slice(1, -1);
      }
      const serviceAccount = JSON.parse(key);
      if (!serviceAccount.project_id) {
        throw new Error("Service account JSON missing project_id");
      }
      return serviceAccount;
    } catch (error) {
      console.error("Invalid FIREBASE_ADMIN_KEY JSON, falling back to separate env vars:", error);
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials are missing. Set FIREBASE_ADMIN_KEY or (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) in .env.local"
    );
  }

  return { projectId, clientEmail, privateKey };
}

function initializeFirebaseAdmin() {
  if (admin.apps.length) {
    return admin;
  }
  const serviceAccount = getServiceAccount();
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return admin;
}

export const firebaseAdmin = initializeFirebaseAdmin();