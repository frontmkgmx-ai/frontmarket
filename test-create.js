import fetch from 'node-fetch';
const PROJECT_ID = 'gen-lang-client-0736685342';
const DATABASE_ID = 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901';

async function test() {
  const res1 = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/stores/FANTASMA/withdrawals`, { method: 'POST', body: '{}' });
  console.log(res1.status, await res1.text());

  const res2 = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/stores/FANTASMA?collectionId=withdrawals`, { method: 'POST', body: '{}' });
  console.log(res2.status, await res2.text());
}
test();
