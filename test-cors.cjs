async function test() {
  try {
    const res = await fetch('https://streamx.frontmk.online/api/storage/v1/buckets/063ee5ca-309a-47f5-a2ed-53bcf8494b48/objects', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://ais-dev-r5mlvrxm7kzaaqfbn6beur-620959772325.us-east1.run.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, X-API-Key'
      }
    });
    console.log(`OPTIONS Status: ${res.status}`);
    console.log('Access-Control-Allow-Origin:', res.headers.get('access-control-allow-origin'));
  } catch(e) {
    console.error(e);
  }
}
test();
