const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const app = initializeApp({
  apiKey: 'AIzaSyBsJNFE4Ggb2ZtY9RZ-S2ajUWzArzyIkoI',
  projectId: 'gen-lang-client-0736685342'
});
const db = getFirestore(app, 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901');

async function run() {
  console.log("Writing without auth (will be denied by rules)...");
  const p = setDoc(doc(db, 'stores', 'test'), {ownerId: '123'});
  let resolved = false;
  let error = null;
  p.then(() => { resolved = true; console.log("Resolved!"); })
   .catch(e => { error = e.code; console.log("Rejected with:", e.code); });
  
  await new Promise(r => setTimeout(r, 2000));
  console.log("Resolved?", resolved, "Error?", error);
  process.exit(0);
}
run();
