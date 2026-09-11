import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// True once real Firebase env vars are present — lets the UI show "online play isn't
// configured yet" instead of crashing when someone runs this before setting up .env.
export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const app = firebaseReady ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig)) : null;

// ignoreUndefinedProperties: a lot of the ported game logic sets fields to `undefined`
// before they're first assigned (e.g. state.bar, team.seasonCap) — Firestore normally
// rejects undefined outright, and auditing every one of those into `null` isn't worth it.
export const db = app ? initializeFirestore(app, { ignoreUndefinedProperties: true }) : null;
export const auth = app ? getAuth(app) : null;
