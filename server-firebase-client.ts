import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0736685342",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:1050257074873:web:03c851d8e7f41421638968",
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyBsJNFE4Ggb2ZtY9RZ-S2ajUWzArzyIkoI",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0736685342.firebaseapp.com",
};

let clientApp;
let clientDb;

export function getClientDb() {
  if (!clientApp) {
    clientApp = initializeApp(firebaseConfig);
    const envDbId = process.env.VITE_FIREBASE_DATABASE_ID;
    const databaseId = (envDbId && !envDbId.startsWith('http')) ? envDbId : 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901';
    clientDb = getFirestore(clientApp, databaseId);
  }
  return clientDb;
}
