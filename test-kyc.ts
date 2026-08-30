import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fetch from 'node-fetch';

const projectId = 'gen-lang-client-0736685342';
const dbId = 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901';

const app = admin.initializeApp({ projectId });
const auth = getAuth(app);
const db = getFirestore(app, dbId);

async function run() {
  try {
    const customToken = await auth.createCustomToken('test-user-123');
    console.log("Custom Token generated.");
    
    // We need an ID token, not a custom token, to hit the backend directly.
    // Let's just mock a request to the express logic directly, or hit the endpoint bypassing auth if we can't generate ID token easily.
  } catch (e) {
    console.error(e);
  }
}
run();
