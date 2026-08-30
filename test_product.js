import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBsJNFE4Ggb2ZtY9RZ-S2ajUWzArzyIkoI",
  projectId: "gen-lang-client-0736685342",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, "ai-studio-f452ed5b-7861-4365-a109-42e00eede901");

async function run() {
  try {
    const cred = await signInWithEmailAndPassword(auth, "test1740756782200@example.com", "123456");
    console.log("Logged in:", cred.user.uid);
    
    // get user's store
    const userDoc = await getDocs(collection(db, 'stores'));
    let myStore = null;
    userDoc.forEach(d => {
      if(d.data().ownerId === cred.user.uid) {
         myStore = d;
      }
    });
    
    if(!myStore) {
      console.log("No store found");
      process.exit();
    }
    
    console.log("My store is:", myStore.id);
    
    const productRef = doc(collection(db, 'stores', myStore.id, 'products'));
    await setDoc(productRef, {
      name: "Test Product",
      price: 100
    });
    
    console.log("Product added:", productRef.id);
    
  } catch(e) {
    console.error(e.message);
  }
  process.exit();
}
run();
