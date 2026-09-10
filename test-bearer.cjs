async function test() {
  const apiKey = 'mk_9325c51c6e03270eb749a87fe9588d129ab1da0d8eb5168b';
  const bucketId = '063ee5ca-309a-47f5-a2ed-53bcf8494b48';
  const formData = new FormData();
  formData.append('file', new Blob(['test']), 'test.txt');

  try {
    const res = await fetch(`https://streamx.frontmk.online/api/storage/v1/buckets/${bucketId}/objects`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });
    console.log(await res.text());
  } catch (e) {
    console.error(e.message);
  }
}
test();
