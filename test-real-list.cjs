async function test() {
  const apiKey = process.env.VITE_STREAMX_API_KEY;

  try {
    const res = await fetch(`https://streamx.frontmk.online/api/storage/v1/buckets`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey }
    });
    console.log(`Status: ${res.status}`);
    console.log(await res.text());
  } catch (e) {
    console.error(e.message);
  }
}
test();
