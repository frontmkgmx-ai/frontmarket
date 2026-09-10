import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID || 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901';
const app = initializeApp({ projectId });

try {
  const db = getFirestore(app, projectId);
  console.log('Success!', db.projectId, db.databaseId);
} catch (e) {
  console.log('Failed:', e.message);
}
