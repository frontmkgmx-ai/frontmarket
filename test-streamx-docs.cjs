async function test() {
  const apiKey = 'mk_9325c51c6e03270eb749a87fe9588d129ab1da0d8eb5168b';
  const formData = new FormData();
  formData.append('file', new Blob(['test']), 'test.txt');

  const urlsToTest = [
    'https://streamx.frontmk.online/api/s3/midia/objects',
    'https://streamx.frontmk.online/api/s3/midia-frontmk/objects',
    'https://streamx.frontmk.online/api/storage/buckets/063ee5ca-309a-47f5-a2ed-53bcf8494b48/files',
    'https://streamx.frontmk.online/api/s3/063ee5ca-309a-47f5-a2ed-53bcf8494b48/objects'
  ];

  for (const url of urlsToTest) {
    try {
      console.log(`Testing ${url}...`);
      const res = await fetch(url, {
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
}
test();
