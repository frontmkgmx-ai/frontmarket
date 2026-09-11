import admin from 'firebase-admin';

async function test() {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'gen-lang-client-0736685342'
      });
    }
    const db = admin.firestore();
    db.settings({ databaseId: 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901' });
    
    const snap = await db.collection('stores').limit(1).get();
    console.log("Success! Docs found:", snap.docs.length);
  } catch (e) {
    console.error("Admin error:", e);
  }
}
test();
