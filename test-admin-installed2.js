import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function test() {
  try {
    if (!getApps().length) {
      initializeApp({
        projectId: 'gen-lang-client-0736685342'
      });
    }
    const db = getFirestore();
    db.settings({ databaseId: 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901' });
    
    const snap = await db.collection('stores').limit(1).get();
    console.log("Success! Docs found:", snap.docs.length);
  } catch (e) {
    console.error("Admin error:", e);
  }
}
test();
