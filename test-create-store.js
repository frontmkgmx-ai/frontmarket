import { getAdminDb, getFirebaseAdmin } from './server-firebase-admin.js';

async function run() {
  const db = getAdminDb();
  await db.collection('stores').doc('test-store-123').set({
    ownerId: 'test-user-uid',
    name: 'Test Store'
  });
  console.log('Store created');
}
run().catch(console.error);
