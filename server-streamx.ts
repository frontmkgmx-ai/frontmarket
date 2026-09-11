import express from 'express';
import multer from 'multer';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);

const upload = multer({ 
  limits: { 
    fileSize: 15 * 1024 * 1024 // 15MB máximo por upload
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const err = new Error('Tipo de arquivo não permitido. Apenas JPEG, PNG, WEBP e GIF são aceitos.');
      (err as any).statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

const SAFE_OBJECT_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function setupStreamxRoutes(app: express.Express, authMiddleware: any) {
  const STREAMX_BASE_URL = 'https://streamx.frontmk.online';

  app.get('/api/storage/image/:id', async (req: any, res: any) => {
    try {
      const BUCKET_ID = (process.env.STREAMX_BUCKET_ID || '38f824b0-eaf6-4e9b-8c44-a40f4839f7b9').trim();
      const STREAMX_API_KEY = (process.env.STREAMX_API_KEY || '').trim();
      const objectId = req.params.id;

      if (!objectId || !SAFE_OBJECT_ID_REGEX.test(objectId)) {
        return res.status(400).json({ error: 'Identificador de objeto inválido.' });
      }

      const response = await fetch(`${STREAMX_BASE_URL}/api/storage/v1/buckets/${BUCKET_ID}/objects/${encodeURIComponent(objectId)}/stream`, {
        headers: STREAMX_API_KEY ? { 'X-API-Key': STREAMX_API_KEY } : {}
      });

      if (!response.ok) {
        return res.status(response.status === 404 ? 404 : 403).send('Imagem não encontrada ou não autorizada.');
      }

      const contentType = response.headers.get('content-type');
      if (contentType && ALLOWED_MIME_TYPES.has(contentType.split(';')[0])) {
        res.setHeader('Content-Type', contentType);
      } else {
        res.setHeader('Content-Type', 'image/jpeg');
      }

      // Security headers em mídia servida
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

      // Stream do buffer diretamente para o cliente
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (err: any) {
      console.error('[StreamX Proxy] Erro ao servir imagem:', err.message);
      res.status(500).send('Erro interno ao buscar imagem.');
    }
  });

  app.post('/api/storage/upload', authMiddleware, upload.single('file'), async (req: any, res: any) => {
    try {
      const BUCKET_ID = (process.env.STREAMX_BUCKET_ID || '38f824b0-eaf6-4e9b-8c44-a40f4839f7b9').trim();
      const STREAMX_API_KEY = (process.env.STREAMX_API_KEY || '').trim();

      if (!STREAMX_API_KEY) {
        return res.status(503).json({ error: 'Serviço de armazenamento não configurado no servidor.' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
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
        console.error('[StreamX Upload] Falha no gateway de mídia:', response.status);
        return res.status(502).json({ error: 'Falha ao processar upload na nuvem.' });
      }

      const data = await response.json();
      
      const objectId = data.id || data.object_id || data.key || data.name;
      if (!objectId || !SAFE_OBJECT_ID_REGEX.test(objectId)) {
        return res.status(502).json({ error: 'Formato de resposta inesperado do provedor de armazenamento.' });
      }

      const proxyUrl = `/api/storage/image/${objectId}`;
      res.json({ url: proxyUrl, id: objectId });
    } catch (err: any) {
      console.error('[StreamX Upload] Erro:', err.message);
      res.status(500).json({ error: 'Erro interno ao realizar upload do arquivo.' });
    }
  });

  app.delete('/api/storage/delete', authMiddleware, async (req: any, res: any) => {
    try {
      const BUCKET_ID = (process.env.STREAMX_BUCKET_ID || '38f824b0-eaf6-4e9b-8c44-a40f4839f7b9').trim();
      const STREAMX_API_KEY = (process.env.STREAMX_API_KEY || '').trim();
      
      if (!STREAMX_API_KEY) {
        return res.status(503).json({ error: 'Serviço de armazenamento não configurado no servidor.' });
      }

      const { fileUrlOrId } = req.body;
      if (!fileUrlOrId || typeof fileUrlOrId !== 'string') {
        return res.status(400).json({ error: 'fileUrlOrId obrigatório.' });
      }

      let objectId = fileUrlOrId.trim();
      const match = fileUrlOrId.match(/\/objects\/([^\/]+)\/stream$/) || 
                    fileUrlOrId.match(/\/image\/([^\/]+)$/) ||
                    fileUrlOrId.match(/\/objects\/([^\/]+)$/);
      if (match && match[1]) {
        objectId = match[1];
      }

      if (!SAFE_OBJECT_ID_REGEX.test(objectId)) {
        return res.status(400).json({ error: 'Identificador de arquivo inválido para exclusão.' });
      }

      const response = await fetch(`${STREAMX_BASE_URL}/api/storage/v1/buckets/${BUCKET_ID}/objects/${encodeURIComponent(objectId)}`, {
        method: 'DELETE',
        headers: {
          'X-API-Key': STREAMX_API_KEY
        }
      });
      
      if (!response.ok) {
        console.warn('[StreamX Delete] Não encontrado ou status:', response.status);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('[StreamX Delete] Erro:', err.message);
      res.status(500).json({ error: 'Erro interno ao excluir arquivo.' });
    }
  });
}
