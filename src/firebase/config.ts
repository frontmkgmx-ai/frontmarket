import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBsJNFE4Ggb2ZtY9RZ-S2ajUWzArzyIkoI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0736685342.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0736685342",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0736685342.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1050257074873",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1050257074873:web:03c851d8e7f41421638968"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
const firestoreDbId = import.meta.env.VITE_FIREBASE_DATABASE_ID?.startsWith('http') 
  ? "ai-studio-f452ed5b-7861-4365-a109-42e00eede901" 
  : (import.meta.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-f452ed5b-7861-4365-a109-42e00eede901");

export const db = getFirestore(app, firestoreDbId);
export const storage = getStorage(app);
