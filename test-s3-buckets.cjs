async function test() {
  const apiKey = process.env.VITE_STREAMX_API_KEY;
  const bucketsToTest = [
    'midia',
    'midia-frontmk',
    'frontmk',
    'storage',
    'assets',
    'public',
    'uploads',
    'bucket',
    '063ee5ca-309a-47f5-a2ed-53bcf8494b48',
    'images',
    'files'
  ];
  
  const formData = new FormData();
  formData.append('file', new Blob(['test']), 'test.txt');

  for (const bucket of bucketsToTest) {
    try {
      const res = await fetch(`https://streamx.frontmk.online/api/s3/${bucket}/objects`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData
      });
      console.log(`${bucket}: ${res.status}`);
    } catch (e) {
      console.error(e.message);
    }
  }
}
test();
