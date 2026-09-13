import { getAdminDb } from './server-firebase-admin.js';
const db = getAdminDb();
db.collection('users').limit(1).get().then(snap => {
  snap.forEach(doc => console.log(doc.data()));
  process.exit(0);
}).catch(console.error);
