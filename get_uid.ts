import { getAdminDb } from './server-firebase-admin.js';
const db = getAdminDb();
db.collection('users').limit(1).get().then(snap => {
  console.log(snap.docs[0].id);
  process.exit(0);
});
