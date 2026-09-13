import fetch from 'node-fetch';
import { getFirebaseAdmin, getAdminDb } from './server-firebase-admin.js';
import { getAuth } from 'firebase-admin/auth';

async function test() {
  const admin = getFirebaseAdmin();
  const db = getAdminDb();
  
  const uid = '7bMXaIdAyQODxlqYCwTjcdNVgxF3';
  const customToken = await getAuth(admin).createCustomToken(uid);
  
  // Can't use custom token as Bearer for verifyIdToken, unfortunately.
  console.log("Just starting the test by calling the API without token, to verify it returns 401 instead of crashing.");
  
  const res = await fetch('http://localhost:3000/api/stores/6rtSibT5GeyX9L6b1Vhk/test-email-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'test', body: 'test body' })
  });
  
  const text = await res.text();
  console.log(res.status, text);
}
test();
