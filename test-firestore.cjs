const admin = require('firebase-admin');
admin.initializeApp({
  projectId: process.env.VITE_FIREBASE_PROJECT_ID
});
const db = admin.firestore();

async function test() {
  const snaps = await db.collection('stores').get();
  for (const store of snaps.docs) {
    console.log(`Store: ${store.id}`);
    const prods = await db.collection('stores').doc(store.id).collection('products').get();
    for (const prod of prods.docs) {
      console.log(`  Product: ${prod.data().name}`);
      console.log(`    Images: ${JSON.stringify(prod.data().images)}`);
    }
  }
}
test().catch(console.error);
