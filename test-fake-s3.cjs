async function test() {
  const apiKey = 'mk_FAKE_KEY';
  const bucketName = 'midia'; 
  
  const formData = new FormData();
  formData.append('file', new Blob(['test']), 'test.txt');

  try {
    const res = await fetch(`https://streamx.frontmk.online/api/s3/${bucketName}/objects`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });
    console.log(`Status: ${res.status}`);
    console.log(await res.text());
  } catch (e) {
    console.error(e.message);
  }
}
test();
