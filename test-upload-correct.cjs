async function test() {
  const newKey = 'mk_6b9df5c1a1e1649fd67a01200757208b66d8e873609846bc';
  const bucketId = '38f824b0-eaf6-4e9b-8c44-a40f4839f7b9';
  
  const formData = new FormData();
  formData.append('file', new Blob(['test file upload works']), 'test-file.txt');

  try {
    const res = await fetch(`https://streamx.frontmk.online/api/storage/v1/buckets/${bucketId}/objects`, {
      method: 'POST',
      headers: { 'X-API-Key': newKey },
      body: formData
    });
    console.log(`Status: ${res.status}`);
    console.log(await res.text());
  } catch (e) {
    console.error(e.message);
  }
}
test();
