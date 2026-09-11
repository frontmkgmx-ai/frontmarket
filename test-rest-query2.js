const PROJECT_ID = 'gen-lang-client-0736685342';
const DATABASE_ID = 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

async function run() {
  const token = 'fake-token';
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'orders' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'status' },
          op: 'EQUAL',
          value: { stringValue: 'paid' }
        }
      }
    }
  };
  
  const res = await fetch(`${BASE_URL}/stores/testStore:runQuery`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  console.log(res.status, await res.text());
}
run();
