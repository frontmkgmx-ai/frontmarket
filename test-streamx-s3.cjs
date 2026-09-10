async function test() {
  const apiKey = 'mk_9325c51c6e03270eb749a87fe9588d129ab1da0d8eb5168b';
  const formData = new FormData();
  formData.append('file', new Blob(['test']), 'test.txt');

  try {
    const res = await fetch('https://streamx.frontmk.online/api/s3/midia/objects', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });
    const text = await res.text();
    console.log(`S3 Result: ${res.status} ${text}`);
  } catch (e) {
    console.error(e.message);
  }
}
test();
