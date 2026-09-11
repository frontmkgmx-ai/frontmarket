const PROJECT_ID = 'gen-lang-client-0736685342';
const DATABASE_ID = 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901';
const API_KEY = 'AIzaSyBsJNFE4Ggb2ZtY9RZ-S2ajUWzArzyIkoI';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

async function run() {
  const res = await fetch(`${BASE_URL}/stores?key=${API_KEY}`);
  const data = await res.json();
  if (data.documents) {
    for (const doc of data.documents) {
      console.log(doc.name);
      console.log('ownerId:', doc.fields?.ownerId?.stringValue);
    }
  } else {
    console.log(data);
  }
}
run();
