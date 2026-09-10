const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  const snaps = await getDocs(collection(db, 'stores'));
  for (const store of snaps.docs) {
    console.log(`Store: ${store.id}`);
    const prods = await getDocs(collection(db, `stores/${store.id}/products`));
    for (const prod of prods.docs) {
      console.log(`  Product: ${prod.data().name}`);
      console.log(`    Images: ${JSON.stringify(prod.data().images)}`);
    }
  }
}
test().then(() => process.exit(0)).catch(console.error);
