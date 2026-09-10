async function test() {
  const apiKey = process.env.VITE_STREAMX_API_KEY;
  const bucketId = '063ee5ca-309a-47f5-a2ed-53bcf8494b48';
  
  try {
    const res = await fetch(`https://streamx.frontmk.online/api/storage/v1/upload/resumable`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'x-bucket': bucketId,
        'Upload-Length': '100',
        'Tus-Resumable': '1.0.0'
      }
    });
    console.log(`Status: ${res.status}`);
    console.log(await res.text());
  } catch (e) {
    console.error(e.message);
  }
}
test();
