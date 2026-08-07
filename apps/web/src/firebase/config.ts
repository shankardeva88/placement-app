// Firebase initialization — web app.
// Uses Realtime Database + Auth only — no billing account required.
// File "uploads" (resumes, offer letters, joining proof) are handled as
// pasted Google Drive share links for now instead of Firebase Storage,
// since Storage also requires the Blaze plan. Swap this back in later —
// see the commented-out storage lines below.
//
// Copy .env.example to .env.local and fill in the values from the
// Firebase Console (Project Settings > General > Your apps > Web app).

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
// import { getStorage } from "firebase/storage"; // re-enable once billing is on

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
// export const storage = getStorage(app); // re-enable once billing is on
