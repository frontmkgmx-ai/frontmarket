import express from 'express';
import multer from 'multer';

const upload = multer({ 
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

export function setupStreamxRoutes(app: express.Express, authMiddleware: any) {
  const STREAMX_BASE_URL = 'https://streamx.frontmk.online';

  app.get('/api/storage/image/:id', async (req: any, res: any) => {
    try {
      const BUCKET_ID = '38f824b0-eaf6-4e9b-8c44-a40f4839f7b9';
      const STREAMX_API_KEY = 'mk_6b9df5c1a1e1649fd67a01200757208b66d8e873609846bc';
      const objectId = req.params.id;

      const response = await fetch(`${STREAMX_BASE_URL}/api/storage/v1/buckets/${BUCKET_ID}/objects/${objectId}/stream`, {
        headers: {
          'X-API-Key': STREAMX_API_KEY
        }
      });

      if (!response.ok) {
        return res.status(response.status).send('Image not found or unauthorized');
      }

      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      // Stream the image buffer directly to the client
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (err: any) {
      console.error('Streamx image proxy error:', err);
      res.status(500).send('Internal server error');
    }
  });

  app.post('/api/storage/upload', authMiddleware, upload.single('file'), async (req: any, res: any) => {
    try {
      const BUCKET_ID = '38f824b0-eaf6-4e9b-8c44-a40f4839f7b9';
      const STREAMX_API_KEY = 'mk_6b9df5c1a1e1649fd67a01200757208b66d8e873609846bc';

      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const formData = new FormData();
      formData.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);

      const response = await fetch(`${STREAMX_BASE_URL}/api/storage/v1/buckets/${BUCKET_ID}/objects`, {
        method: 'POST',
        headers: {
          'X-API-Key': STREAMX_API_KEY
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Streamx upload error:', errorText);
        return res.status(response.status).json({ error: `Upload failed: ${response.status}`, details: errorText });
      }

      const data = await response.json();
      
      const objectId = data.id || data.object_id || data.key || data.name;
      if (!objectId) {
        return res.status(500).json({ error: 'Unknown response format from Streamx' });
      }

      const proxyUrl = `/api/storage/image/${objectId}`;
      res.json({ url: proxyUrl, id: objectId, data });
    } catch (err: any) {
      console.error('Streamx proxy error:', err);
      res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  });

  app.delete('/api/storage/delete', authMiddleware, async (req: any, res: any) => {
    try {
      const BUCKET_ID = '38f824b0-eaf6-4e9b-8c44-a40f4839f7b9';
      const STREAMX_API_KEY = 'mk_6b9df5c1a1e1649fd67a01200757208b66d8e873609846bc';
      
      const { fileUrlOrId } = req.body;
      if (!fileUrlOrId) {
        return res.status(400).json({ error: 'Missing fileUrlOrId' });
      }

      let objectId = fileUrlOrId;
      const match = fileUrlOrId.match(/\/objects\/([^\/]+)\/stream$/);
      if (match && match[1]) {
        objectId = match[1];
      } else {
        const s3Match = fileUrlOrId.match(/\/objects\/([^\/]+)$/);
        if (s3Match && s3Match[1]) {
           objectId = s3Match[1];
        }
      }

      const response = await fetch(`${STREAMX_BASE_URL}/api/storage/v1/buckets/${BUCKET_ID}/objects/${objectId}`, {
        method: 'DELETE',
        headers: {
          'X-API-Key': STREAMX_API_KEY
        }
      });
      
      if (!response.ok) {
        console.warn('Streamx delete error/not found:', response.status);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('Streamx proxy delete error:', err);
      res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  });
}
