async function test() {
  const keys = [
    process.env.VITE_STREAMX_API_KEY,
    'mk_9325c51c6e03270eb749a87fe9588d129ab1da0d8eb5168b'
  ];
  
  for (const k of keys) {
    if(!k) continue;
    console.log('Testing key:', k);
    const res = await fetch('https://streamx.frontmk.online/api/storage/v1/overview', {
      headers: { 'X-API-Key': k }
    });
    console.log(res.status, await res.text());
  }
}
test();
