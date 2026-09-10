async function test() {
  const newKey = 'mk_6b9df5c1a1e1649fd67a01200757208b66d8e873609846bc';
  
  const tests = [
    { name: 'v1 list with X-API-Key', url: `https://streamx.frontmk.online/api/storage/v1/buckets`, headers: { 'X-API-Key': newKey } },
    { name: 'v1 list with Bearer', url: `https://streamx.frontmk.online/api/storage/v1/buckets`, headers: { 'Authorization': `Bearer ${newKey}` } },
    { name: 's3 overview', url: `https://streamx.frontmk.online/api/storage/v1/overview`, headers: { 'X-API-Key': newKey } }
  ];

  for (const t of tests) {
    try {
      console.log(`Testing ${t.name}...`);
      const res = await fetch(t.url, { method: 'GET', headers: t.headers });
      console.log(`Status: ${res.status} - ${await res.text()}`);
    } catch (e) {
      console.error(e.message);
    }
  }
}
test();
