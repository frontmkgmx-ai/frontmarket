async function test() {
  const apiKey = process.env.VITE_STREAMX_API_KEY;
  try {
    const res = await fetch(`https://streamx.frontmk.online/api/s3/midia/objects`, {
      method: 'GET',
      headers: { 'x-api-key': apiKey }
    });
    console.log(`Status: ${res.status}`);
    console.log(await res.text());
  } catch (e) {
    console.error(e.message);
  }
}
test();
