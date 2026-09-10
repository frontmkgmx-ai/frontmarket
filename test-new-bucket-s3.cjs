async function test() {
  const apiKey = process.env.VITE_STREAMX_API_KEY;
  const bucketId = process.env.VITE_STREAMX_BUCKET_ID;
  const formData = new FormData();
  formData.append('file', new Blob(['test']), 'test.txt');

  try {
    const res = await fetch(`https://streamx.frontmk.online/api/s3/${bucketId}/objects`, {
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
