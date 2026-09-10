import { initializeApp, App, cert } from 'firebase-admin/app';
import { getFirestore as getFirebaseFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let firebaseAdminApp: App | null = null;
let firestoreDbId = '(default)';
let actualProjectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

// Read config if available
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.projectId) actualProjectId = config.projectId;
    if (config.firestoreDatabaseId) firestoreDbId = config.firestoreDatabaseId;
  }
} catch (e) {
  console.error("Could not load firebase-applet-config.json", e);
}

export function getFirebaseAdmin(): App {
  if (!firebaseAdminApp) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        firebaseAdminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || actualProjectId,
        });
      } catch (err) {
        console.error('Error parsing FIREBASE_SERVICE_ACCOUNT JSON', err);
        throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON');
      }
    } else {
      firebaseAdminApp = initializeApp({
        projectId: actualProjectId
      });
      console.log('[INFO] Initialized Firebase Admin without FIREBASE_SERVICE_ACCOUNT. Project:', actualProjectId);
    }
  }
  return firebaseAdminApp;
}

export function getAdminDb() {
  const app = getFirebaseAdmin();
  console.log('[INFO] Getting Firestore for databaseId:', firestoreDbId);
  return getFirebaseFirestore(app, firestoreDbId);
}
