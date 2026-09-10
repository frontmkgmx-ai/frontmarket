import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";

const firebaseConfig = {
  projectId: "gen-lang-client-0736685342",
  appId: "1:1050257074873:web:03c851d8e7f41421638968",
  apiKey: "AIzaSyBsJNFE4Ggb2ZtY9RZ-S2ajUWzArzyIkoI",
  authDomain: "gen-lang-client-0736685342.firebaseapp.com",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-f452ed5b-7861-4365-a109-42e00eede901");

async function test() {
  try {
    const q = query(collection(db, "stores"), limit(1));
    const snap = await getDocs(q);
    console.log("Success! Docs:", snap.size);
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
