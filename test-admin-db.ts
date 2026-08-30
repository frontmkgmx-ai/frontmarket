import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
const app = admin.initializeApp({ projectId: 'gen-lang-client-0736685342' });
const db = getFirestore(app, 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901');
console.log(db ? "success" : "failed");
