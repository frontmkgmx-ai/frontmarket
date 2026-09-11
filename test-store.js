import { getFirebaseAdmin, getAdminDb } from './dist/server.cjs';
async function run() {
  const db = getAdminDb();
  const snap = await db.collection('stores').limit(1).get();
  if (snap.empty) {
    console.log("No stores");
  } else {
    console.log(snap.docs[0].id, snap.docs[0].data().ownerId);
  }
}
run();
