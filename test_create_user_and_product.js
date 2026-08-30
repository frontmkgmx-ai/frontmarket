import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, doc, setDoc, query, limit } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBsJNFE4Ggb2ZtY9RZ-S2ajUWzArzyIkoI",
  projectId: "gen-lang-client-0736685342",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, "ai-studio-f452ed5b-7861-4365-a109-42e00eede901");

async function run() {
  try {
    const email = "test" + Date.now() + "@example.com";
    const cred = await createUserWithEmailAndPassword(auth, email, "123456");
    console.log("Created user:", cred.user.uid);
    
    // Create store
    const storeRef = doc(collection(db, 'stores'));
    await setDoc(storeRef, {
      name: "Test Store",
      ownerId: cred.user.uid
    });
    console.log("Created store:", storeRef.id);
    
    // Now try to add a product
    const productRef = doc(collection(db, 'stores', storeRef.id, 'products'));
    try {
      await setDoc(productRef, {
        name: "Test Product",
        price: 100
      });
      console.log("Product added successfully:", productRef.id);
    } catch(e) {
      console.error("Product add failed:", e.code, e.message);
    }
  } catch(e) {
    console.error("Error:", e.message);
  }
  process.exit();
}
run();
