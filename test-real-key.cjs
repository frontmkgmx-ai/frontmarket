async function test() {
  const apiKey = process.env.VITE_STREAMX_API_KEY;
  const bucketId = process.env.VITE_STREAMX_BUCKET_ID || '063ee5ca-309a-47f5-a2ed-53bcf8494b48';
  
  const formData = new FormData();
  formData.append('file', new Blob(['test real key']), 'test-real.txt');

  try {
    const res = await fetch(`https://streamx.frontmk.online/api/storage/v1/buckets/${bucketId}/objects`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: formData
    });
    console.log(`Status: ${res.status}`);
    console.log(await res.text());
  } catch (e) {
    console.error(e.message);
  }
}
test();
