/**
 * Firebase Admin SDK singleton initializer.
 * Reads credentials from environment variables — never hardcoded.
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (base64-encoded PEM, or raw PEM with \n escaped as \\n)
 */

import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let app: App;
let db: Firestore;

function getFirebaseAdmin(): { app: App; db: Firestore } {
  if (app && db) return { app, db };

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error(
      "Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
  }

  // Support both raw PEM (with literal \n) and base64-encoded variants
  let privateKey: string;
  if (privateKeyRaw.startsWith("-----BEGIN")) {
    privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  } else {
    // Assume base64 encoded
    privateKey = Buffer.from(privateKeyRaw, "base64").toString("utf-8");
  }

  if (getApps().length === 0) {
    app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    app = getApps()[0]!;
  }

  db = getFirestore(app);
  return { app, db };
}

export { getFirebaseAdmin };
