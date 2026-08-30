import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fetch from 'node-fetch';

const projectId = 'gen-lang-client-0736685342';
const dbId = 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901';
const app = admin.initializeApp({ projectId });

try {
  const db = getFirestore(app, dbId);
  db.collection('users').limit(1).get().then(snap => {
    console.log("Read success, docs:", snap.docs.length);
  }).catch(e => {
    console.error("Read failed:", e);
  });
} catch (e) {
  console.error(e);
}
