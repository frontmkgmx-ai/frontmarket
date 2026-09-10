import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

try {
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'gen-lang-client-0736685342'
  });
  const token = await getAuth(app).createCustomToken('backend-admin');
  console.log('Custom Token:', token.substring(0, 20) + '...');
} catch (e) {
  console.error(e);
}
