const STREAMX_BASE_URL = 'https://streamx.frontmk.online/api/s3';
const BUCKET_NAME = 'midia';
const STREAMX_API_KEY = 'mk_9325c51c6e03270eb749a87fe9588d129ab1da0d8eb5168b';

export async function uploadFileToStreamx(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${STREAMX_BASE_URL}/${BUCKET_NAME}/objects`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STREAMX_API_KEY}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload file to Streamx: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  // The S3 endpoint returns { key, size, url }
  if (data.url) {
    return data.url;
  }
  
  const objectId = data.key || data.id || data.object_id || data.name;
  if (!objectId) {
      console.warn('Unknown response format from Streamx:', data);
      throw new Error('Could not determine file URL from response');
  }

  return `${STREAMX_BASE_URL}/${BUCKET_NAME}/objects/${objectId}`;
}

export async function deleteFileFromStreamx(fileUrl: string): Promise<void> {
  try {
    // Attempt to extract the object key from the URL
    // Format: https://streamx.frontmk.online/api/s3/midia/objects/foto.jpg
    const match = fileUrl.match(/\/objects\/([^\/]+)$/);
    if (match && match[1]) {
      const objectId = match[1];
      await fetch(`${STREAMX_BASE_URL}/${BUCKET_NAME}/objects/${objectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${STREAMX_API_KEY}`
        }
      });
    }
  } catch (err) {
    console.error('Error deleting file from Streamx:', err);
  }
}

