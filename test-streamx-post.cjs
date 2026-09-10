async function test() {
  const formData = new FormData();
  formData.append('file', new Blob(['test']), 'test.txt');

  const res = await fetch('https://streamx.frontmk.online/api/storage/v1/buckets/063ee5ca-309a-47f5-a2ed-53bcf8494b48/objects', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer test-token'
    },
    body: formData
  });

  const text = await res.text();
  console.log(res.status, text);
}
test();
