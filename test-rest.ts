import { restGetDocs } from './firestore-rest.js';
async function test() {
  try {
    const docs = await restGetDocs('stores', 'fake-token');
    console.log(docs);
  } catch(e) {
    console.error(e.message);
  }
}
test();
