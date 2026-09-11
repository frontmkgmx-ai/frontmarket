const PROJECT_ID = 'gen-lang-client-0736685342';
const DATABASE_ID = 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901';

async function test() {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/stores/FANTASMA?collectionId=withdrawals`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { status: { stringValue: 'pending' } } })
  });
  console.log(res.status, await res.text());
}
test();
