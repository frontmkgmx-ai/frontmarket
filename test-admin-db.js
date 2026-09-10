const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({ projectId: "gen-lang-client-0736685342" });
try {
  const db = getFirestore(app, "ai-studio-f452ed5b-7861-4365-a109-42e00eede901");
  console.log("Success with 2 args. Database ID:", db.databaseId);
} catch (e) {
  console.error("Error with 2 args:", e.message);
  try {
     const app2 = initializeApp({ projectId: "gen-lang-client-0736685342", databaseId: "ai-studio-f452ed5b-7861-4365-a109-42e00eede901" }, "app2");
     const db2 = getFirestore(app2);
     console.log("Success with config databaseId:", db2.databaseId);
  } catch (e2) {
     console.error("Error with config databaseId:", e2.message);
  }
}
