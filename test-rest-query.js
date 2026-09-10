import fetch from 'node-fetch';

async function test() {
  const projectId = 'gen-lang-client-0736685342';
  const databaseId = 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901';
  
  const parent = `projects/${projectId}/databases/${databaseId}/documents/stores/ANY_STORE`;
  console.log("Parent:", parent);
}
test();
