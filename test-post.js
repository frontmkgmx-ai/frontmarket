import fetch from 'node-fetch';
const PROJECT_ID = 'gen-lang-client-0736685342';
const DATABASE_ID = 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901';

async function test() {
  const url1 = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/stores/FANTASMA/withdrawals`;
  const url2 = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/stores/FANTASMA?collectionId=withdrawals`;
  
  console.log("URL1:", url1);
  console.log("URL2:", url2);
}
test();
