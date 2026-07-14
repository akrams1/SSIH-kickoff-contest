import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Config is PUBLIC by design (it ships in the browser bundle) — NOT a secret.
// Your data is protected by firestore.rules, not by hiding this.
// Values read from env first; fallbacks let the app run before you set .env.local.
// For a PUBLIC repo, delete the fallbacks.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAH52ZKcrpvkMpwVJaFBeFQ4WhU8aq3CNM",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "pj-project-e9b1c.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "pj-project-e9b1c",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "pj-project-e9b1c.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "373835336600",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:373835336600:web:2ae5919a8970fe310839ed",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-BLXGXSVLFM"
};

// Guard against re-init during Next.js fast refresh / multiple imports.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
