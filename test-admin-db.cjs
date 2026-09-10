const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({ projectId: "gen-lang-client-0736685342" });
try {
  const db = getFirestore(app, "ai-studio-f452ed5b-7861-4365-a109-42e00eede901");
  console.log("Success with 2 args. Database ID:", db.databaseId);
  db.collection('stores').limit(1).get().then(snap => console.log('Snap size:', snap.size)).catch(e => console.error('Snap error:', e.message));
} catch (e) {
  console.error("Error with 2 args:", e.message);
}
