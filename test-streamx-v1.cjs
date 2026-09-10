async function test() {
  const apiKey = 'mk_9325c51c6e03270eb749a87fe9588d129ab1da0d8eb5168b';
  const formData = new FormData();
  formData.append('file', new Blob(['test v1 API']), 'test-v1.txt');

  try {
    const res = await fetch('https://streamx.frontmk.online/api/storage/v1/buckets/063ee5ca-309a-47f5-a2ed-53bcf8494b48/objects', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: formData
    });
    const text = await res.text();
    console.log(`Result: ${res.status} ${text}`);
  } catch (e) {
    console.error(e.message);
  }
}
test();
