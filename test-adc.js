import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

try {
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'gen-lang-client-0736685342'
  });
  const db = getFirestore(app, 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901');
  
  const snap = await db.collection('stores').limit(1).get();
  console.log('Success! Docs:', snap.size);
} catch (e) {
  console.error(e);
}
