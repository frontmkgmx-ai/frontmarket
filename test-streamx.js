const fs = require('fs');

async function testUpload() {
  const formData = new FormData();
  formData.append('file', new Blob(['test file content']), 'test.txt');

  try {
    const res = await fetch('https://streamx.frontmk.online/api/storage/v1/buckets/063ee5ca-309a-47f5-a2ed-53bcf8494b48/objects', {
      method: 'POST',
      body: formData
    });
    console.log(res.status);
    console.log(await res.text());
  } catch (err) {
    console.error(err);
  }
}

testUpload();
