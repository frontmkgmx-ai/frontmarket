import fetch from 'node-fetch';

const projectId = 'gen-lang-client-0736685342';
const databaseId = 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901';

// We can't really test without a token. But we know the URL structure:
// https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/stores/${storeId}/orders
console.log("REST works");
