async function test() {
  const newKey = 'mk_6b9df5c1a1e1649fd67a01200757208b66d8e873609846bc';
  const bucketId = '063ee5ca-309a-47f5-a2ed-53bcf8494b48';
  
  const formData = new FormData();
  formData.append('file', new Blob(['test']), 'test.txt');

  const tests = [
    { name: 'v1 with X-API-Key', url: `https://streamx.frontmk.online/api/storage/v1/buckets/${bucketId}/objects`, headers: { 'X-API-Key': newKey } },
    { name: 'v1 with Bearer', url: `https://streamx.frontmk.online/api/storage/v1/buckets/${bucketId}/objects`, headers: { 'Authorization': `Bearer ${newKey}` } },
    { name: 's3 with Bearer midia', url: `https://streamx.frontmk.online/api/s3/midia/objects`, headers: { 'Authorization': `Bearer ${newKey}` } },
    { name: 's3 with Bearer bucketId', url: `https://streamx.frontmk.online/api/s3/${bucketId}/objects`, headers: { 'Authorization': `Bearer ${newKey}` } }
  ];

  for (const t of tests) {
    try {
      console.log(`Testing ${t.name}...`);
      const res = await fetch(t.url, { method: 'POST', headers: t.headers, body: formData });
      console.log(`Status: ${res.status} - ${await res.text()}`);
    } catch (e) {
      console.error(e.message);
    }
  }
}
test();
