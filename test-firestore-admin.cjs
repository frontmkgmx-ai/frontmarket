const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
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
