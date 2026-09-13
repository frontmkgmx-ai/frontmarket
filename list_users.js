import { getAdminDb } from './dist/server-firebase-admin.cjs';
const db = getAdminDb();
db.collection('users').limit(1).get().then(snap => {
  snap.forEach(doc => console.log(doc.data()));
}).catch(console.error);
