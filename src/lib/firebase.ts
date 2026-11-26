import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import type { ProblemProgress } from "../types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL || "").trim().toLowerCase();
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.authDomain
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export function isOwnerUser(user: User | null): boolean {
  if (!user || !user.email) return false;
  if (!OWNER_EMAIL) return true; // If VITE_OWNER_EMAIL not pinned, authenticated Firebase user is owner (still enforce UID in firestore.rules!)
  return user.email.toLowerCase() === OWNER_EMAIL;
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

export async function ownerSignIn(email: string, password: string): Promise<User> {
  if (!auth) throw new Error("Firebase is not configured in .env");
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  if (OWNER_EMAIL && cred.user.email?.toLowerCase() !== OWNER_EMAIL) {
    await signOut(auth);
    throw new Error("This account is not authorized as the repository owner.");
  }
  return cred.user;
}

export async function ownerSignOut(): Promise<void> {
  if (auth) await signOut(auth);
}

export async function loadAllProgress(uid: string): Promise<Record<string, ProblemProgress>> {
  if (!db) return {};
  const snap = await getDocs(collection(db, "users", uid, "progress"));
  const map: Record<string, ProblemProgress> = {};
  snap.forEach((d) => {
    map[d.id] = d.data() as ProblemProgress;
  });
  return map;
}

export async function saveProblemProgress(uid: string, item: ProblemProgress): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, "users", uid, "progress", item.key), item, { merge: true });
}

export interface OwnerPrivateSettings {
  geminiKey?: string;
  targetLcRating?: number;
  targetCfRating?: number;
  cfHandle?: string;
  lcHandle?: string;
  acHandle?: string;
}

export async function loadOwnerSettings(uid: string): Promise<OwnerPrivateSettings> {
  if (!db) return {};
  const snap = await getDoc(doc(db, "users", uid, "private", "settings"));
  return snap.exists() ? (snap.data() as OwnerPrivateSettings) : {};
}

export async function saveOwnerSettings(uid: string, settings: OwnerPrivateSettings): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, "users", uid, "private", "settings"), settings, { merge: true });
}
