import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";

let adminApp: App | undefined;

function getAdminApp(): App {
  if (!adminApp) {
    if (!process.env.FIREBASE_ADMIN_KEY) {
      throw new Error("FIREBASE_ADMIN_KEY environment variable is not set");
    }

    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
    } catch (e) {
      throw new Error("FIREBASE_ADMIN_KEY contains invalid JSON");
    }

    if (!serviceAccount.project_id) {
      throw new Error("Firebase Admin service account must contain 'project_id'");
    }

    if (getApps().length === 0) {
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      adminApp = getApps()[0];
    }
  }
  return adminApp;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminMessaging() {
  return getMessaging(getAdminApp());
}

export function getAdminStorage() {
  return getStorage(getAdminApp());
}