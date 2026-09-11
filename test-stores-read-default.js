const PROJECT_ID = 'gen-lang-client-0736685342';
const DATABASE_ID = '(default)';
const API_KEY = 'AIzaSyBsJNFE4Ggb2ZtY9RZ-S2ajUWzArzyIkoI';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

async function run() {
  const res = await fetch(`${BASE_URL}/stores?key=${API_KEY}`);
  const data = await res.json();
  console.log(data);
}
run();
