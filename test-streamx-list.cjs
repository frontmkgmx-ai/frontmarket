async function test() {
  const apiKey = 'mk_9325c51c6e03270eb749a87fe9588d129ab1da0d8eb5168b';

  try {
    const res = await fetch('https://streamx.frontmk.online/api/storage/v1/buckets', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const text = await res.text();
    console.log(`List Result: ${res.status} ${text}`);
    
    const res2 = await fetch('https://streamx.frontmk.online/api/storage/v1/buckets', {
      method: 'GET',
      headers: { 'X-API-Key': apiKey }
    });
    const text2 = await res2.text();
    console.log(`List Result (X-API-Key): ${res2.status} ${text2}`);
  } catch (e) {
    console.error(e.message);
  }
}
test();
