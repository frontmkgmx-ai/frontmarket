async function test() {
  const apiKey = 'mk_9325c51c6e03270eb749a87fe9588d129ab1da0d8eb5168b';
  const bucketName = 'midia';
  const formData = new FormData();
  formData.append('file', new Blob(['test via proxy script']), 'test-proxy.txt');

  try {
    const res = await fetch(`https://streamx.frontmk.online/api/s3/${bucketName}/objects`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });
    const text = await res.text();
    console.log(`Result: ${res.status} ${text}`);
  } catch (e) {
    console.error(e.message);
  }
}
test();
