import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'gen-lang-client-0736685342',
  apiKey: 'AIzaSyBsJNFE4Ggb2ZtY9RZ-S2ajUWzArzyIkoI'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901');

async function run() {
  try {
    const snap = await getDocs(collection(db, 'stores'));
    console.log("Stores read:", snap.docs.length);
    process.exit(0);
  } catch (e) {
    console.error(e.code, e.message);
    process.exit(1);
  }
}
run();
