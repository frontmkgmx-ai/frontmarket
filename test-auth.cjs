async function test() {
  const apiKey = 'mk_9325c51c6e03270eb749a87fe9588d129ab1da0d8eb5168b';
  const bucketId = '063ee5ca-309a-47f5-a2ed-53bcf8494b48';
  
  const headersToTest = [
    { 'Authorization': `Bearer ${apiKey}` },
    { 'X-API-Key': apiKey },
    { 'x-api-key': apiKey },
    { 'Authorization': apiKey }
  ];

  for (const headers of headersToTest) {
    try {
      console.log(`Testing headers:`, headers);
      const res = await fetch(`https://streamx.frontmk.online/api/storage/v1/buckets/${bucketId}/objects`, {
        method: 'GET',
        headers
      });
      const text = await res.text();
      console.log(`Result: ${res.status} ${text.substring(0, 100)}\n`);
    } catch(e) {
      console.error(e.message);
    }
  }
}
test();
