const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, disableNetwork } = require('firebase/firestore');

const app = initializeApp({
  apiKey: 'AIzaSyBsJNFE4Ggb2ZtY9RZ-S2ajUWzArzyIkoI',
  projectId: 'gen-lang-client-0736685342'
});
const db = getFirestore(app, 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901');

async function run() {
  await disableNetwork(db);
  console.log("Network disabled");
  const p = setDoc(doc(db, 'test', 'test'), {a: 1});
  let resolved = false;
  p.then(() => { resolved = true; console.log("Resolved!"); });
  await new Promise(r => setTimeout(r, 2000));
  console.log("Resolved after 2s?", resolved);
  process.exit(0);
}
run();
