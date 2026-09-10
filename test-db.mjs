import { getFirebaseAdmin, getAdminDb } from './dist/server-firebase-admin.js';

async function test() {
  try {
    console.log("Getting DB");
    const db = getAdminDb();
    const snap = await db.collection('stores').limit(1).get();
    console.log("Success! Docs:", snap.docs.length);
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
