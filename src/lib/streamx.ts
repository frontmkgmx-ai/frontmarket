import { useAuthStore } from '../store/authStore';

export interface StreamxObject {
  id: string;
  name: string;
  size?: number;
  mime_type?: string;
  created_at?: string;
}

const getAuthHeaders = async () => {
  const token = await useAuthStore.getState().user?.getIdToken();
  if (!token) {
    throw new Error('User not authenticated');
  }
  return {
    'Authorization': `Bearer ${token}`
  };
};

/**
 * Upload a file and return its public stream URL via proxy
 */
export async function uploadFileToStreamx(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const headers = await getAuthHeaders();
  
  const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/storage/upload`, {
    method: 'POST',
    headers,
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
       throw new Error(`Credenciais do Streamx (API Key ou Bucket ID) estão incorretas ou sem permissão. Verifique o seu painel MyCloud.`);
    }
    throw new Error(`Failed to upload file: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  if (data.url) {
    return data.url;
  }
  
  throw new Error('Unknown response format from Streamx Proxy');
}

/**
 * Delete an object by its Stream URL or ID via proxy
 */
export async function deleteFileFromStreamx(fileUrlOrId: string): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${import.meta.env.VITE_API_URL || ''}/api/storage/delete`, {
      method: 'DELETE',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fileUrlOrId })
    });
  } catch (err) {
    console.error('Error deleting file:', err);
  }
}

/**
 * Resolves an image URL. If it's a direct Streamx URL, rewrites it to use the local proxy.
 */
export function resolveStreamxImageUrl(url: string): string {
  if (!url) return url;
  
  // If it's already a proxy URL or external URL, return it
  const apiUrl = import.meta.env.VITE_API_URL || '';
  if (url.startsWith(`${apiUrl}/api/storage/image/`) || url.startsWith('/api/storage/image/') || (!url.includes('streamx.frontmk.online'))) {
    return url;
  }

  // Extract the object ID from a Streamx URL
  const streamMatch = url.match(/\/objects\/([^\/]+)\/stream$/);
  if (streamMatch && streamMatch[1]) {
    return `${apiUrl}/api/storage/image/${streamMatch[1]}`;
  }

  const s3Match = url.match(/\/objects\/([^\/]+)$/);
  if (s3Match && s3Match[1]) {
     return `${apiUrl}/api/storage/image/${s3Match[1]}`;
  }

  // If it can't be parsed, return original
  return url;
}
