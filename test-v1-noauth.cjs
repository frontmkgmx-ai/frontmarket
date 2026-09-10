async function test() {
  const bucketId = '063ee5ca-309a-47f5-a2ed-53bcf8494b48';
  try {
    const res = await fetch(`https://streamx.frontmk.online/api/storage/v1/buckets/${bucketId}/objects`, {
      method: 'GET'
    });
    console.log(`Status: ${res.status}`);
    console.log(await res.text());
  } catch (e) {
    console.error(e.message);
  }
}
test();
