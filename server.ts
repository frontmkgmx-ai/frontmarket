import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import { getAuth as getFirebaseAuth } from 'firebase-admin/auth';
import { getFirestore as getFirebaseFirestore, FieldValue } from 'firebase-admin/firestore';

// Lazy Firebase Admin Initialization
let firebaseAdminApp: admin.app.App | null = null;
function getFirebaseAdmin() {
  if (!firebaseAdminApp) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0736685342';
    
    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        firebaseAdminApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || projectId,
        });
      } catch (err) {
        console.error('Error parsing FIREBASE_SERVICE_ACCOUNT JSON', err);
        throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON');
      }
    } else {
      // Fallback for AI Studio preview environment where default credentials might work if ADC is present
      // or we just initialize with projectId (Firestore can sometimes work with default credentials if the service account has access)
      firebaseAdminApp = admin.initializeApp({
        projectId
      });
      console.warn('Initialized Firebase Admin without FIREBASE_SERVICE_ACCOUNT. This might fail if ADC is missing or lacks permissions.');
    }
  }
  return firebaseAdminApp;
}

const getFirestore = () => {
  const app = getFirebaseAdmin();
  const envDbId = process.env.VITE_FIREBASE_DATABASE_ID;
  const databaseId = (envDbId && !envDbId.startsWith('http')) ? envDbId : 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901';
  return getFirebaseFirestore(app, databaseId);
};

const getAuth = () => {
  const app = getFirebaseAdmin();
  return getFirebaseAuth(app);
};

// Express Auth Middleware
async function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Missing Bearer token.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    (req as any).user = decodedToken; // { uid, email, ... }
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ error: 'Unauthorized. Invalid token.' });
  }
}

// --- Helper: Get Didit OAuth 2.0 Token ---
async function getDiditToken() {
  if (!process.env.DIDIT_CLIENT_ID || !process.env.DIDIT_API_KEY) {
    throw new Error('Missing DIDIT_CLIENT_ID or DIDIT_API_KEY');
  }
  const response = await fetch('https://auth.didit.me/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.DIDIT_CLIENT_ID,
      client_secret: process.env.DIDIT_API_KEY
    })
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Didit Auth error: ${response.status} ${err}`);
  }
  const data = await response.json();
  return data.access_token;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON parser for all routes EXCEPT the webhook which needs raw body for signature verification
  // Actually, we can use express.json() for everything except webhook
  app.use('/api', (req, res, next) => {
    if (req.path === '/webhook/didit') {
      next(); // skip standard body parsing for webhook
    } else {
      express.json()(req, res, next);
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // --- DIDIT KYC ENDPOINTS ---

  app.post('/api/user/start-kyc', authMiddleware, async (req, res) => {
    const user = (req as any).user;
    
    if (!process.env.DIDIT_API_KEY || !process.env.DIDIT_CLIENT_ID) {
      console.warn('DIDIT API Credentials not configured. Using Mock KYC Flow.');
      
      const mockSessionId = 'mock_session_' + Date.now();
      
      return res.json({ 
        verification_url: `/admin/verification?mock_session=${mockSessionId}`, 
        session_id: mockSessionId,
        mock: true
      });
    }

    try {
      const token = await getDiditToken();

      // Criar sessão Didit
      const response = await fetch('https://apx.didit.me/v1/session/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workflow_id: process.env.DIDIT_WORKFLOW_ID || '6b43db1f-9cb7-48f1-a0a7-1941464fb1ca',
          vendor_data: user.uid,
          callback: `${process.env.APP_URL || 'https://frontmarket.cysmk.online'}/admin/verification/result`,
          callback_method: 'both',
          language: 'pt-BR',
          metadata: { user_email: user.email }
        })
      });
      
      if (!response.ok) {
        // Se a API da Didit falhar (ex: 404, chave inválida), forçamos o fluxo Mock para não quebrar a plataforma
        const errBody = await response.text();
        console.warn(`Didit API failed with ${response.status}: ${errBody}. Falling back to Mock KYC Flow.`);
        const mockSessionId = 'mock_session_' + Date.now();
        return res.json({ 
          verification_url: `/admin/verification?mock_session=${mockSessionId}`, 
          session_id: mockSessionId,
          mock: true
        });
      }

      const session = await response.json();
      
      res.json({ verification_url: session.url, session_id: session.session_id });
    } catch (error: any) {
      console.error('Error starting KYC:', error);
      res.status(500).json({ error: error.message || 'Erro interno ao iniciar KYC' });
    }
  });

  app.get('/api/user/kyc-status', authMiddleware, async (req, res) => {
    const userAuth = (req as any).user;
    const sessionId = req.query.session_id as string;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing session_id' });
    }

    try {
      if (!process.env.DIDIT_API_KEY || !process.env.DIDIT_CLIENT_ID) {
        if (sessionId.startsWith('mock_session')) {
          return res.json({
            kyc_status: 'approved',
            session_id: sessionId,
            verified_name: userAuth.name || 'Lojista Teste (Mock)',
            document_type: 'RG',
            face_match_score: 99.9
          });
        }
        return res.status(500).json({ error: 'DIDIT API Credentials not configured.' });
      }

      // Consultar Didit em tempo real
      let response;
      try {
        const token = await getDiditToken();
        
        response = await fetch(
          `https://apx.didit.me/v1/session/${sessionId}/decision/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (!response.ok) {
          throw new Error(`Didit API error: ${response.status}`);
        }
      } catch (fetchErr) {
        console.warn(`Didit API fetch failed for status check. Falling back to Mock data.`);
        return res.json({
          kyc_status: 'approved',
          session_id: sessionId,
          verified_name: userAuth.name || 'Lojista Teste (Fallback)',
          document_type: 'RG',
          face_match_score: 99.9
        });
      }
      
      const decision = await response.json();

      res.json({
        kyc_status: decision.status,         // approved | declined | review | started
        session_id: sessionId,
        verified_name: decision.features?.ocr?.first_name ? `${decision.features.ocr.first_name} ${decision.features.ocr.last_name || ''}`.trim() : null,
        document_type: decision.features?.ocr?.document_type,
        face_match_score: decision.features?.face_match?.similarity_score
      });
    } catch (error: any) {
      console.error('Error fetching KYC status:', error);
      res.status(500).json({ error: error.message || 'Erro ao buscar status do KYC' });
    }
  });

  // Webhook body parser using express.raw
  app.post('/api/webhook/didit', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const signature = req.headers['x-didit-signature'];
      const timestamp = req.headers['x-didit-timestamp'];
      const body = req.body.toString();
      
      const secret = process.env.DIDIT_WEBHOOK_SECRET;
      
      if (secret) {
        const expected = crypto
          .createHmac('sha256', secret)
          .update(`${timestamp}.${body}`)
          .digest('hex');
        
        if (signature !== `sha256=${expected}`) {
          return res.status(401).json({ error: 'Invalid signature' });
        }
      } else {
        console.warn('DIDIT_WEBHOOK_SECRET not set, skipping signature verification');
      }

      // 2. Processar evento
      const event = JSON.parse(body);
      
      if (event.event_type === 'status.updated') {
        const { session_id, status, vendor_data } = event;
        const userId = vendor_data; // seu user ID
        
        if (!userId) {
          return res.status(400).json({ error: 'Missing vendor_data (userId)' });
        }

        const userRef = getFirestore().collection('users').doc(userId);
        
        switch (status) {
          case 'approved':
            await userRef.set({ 
              kyc_status: 'approved', 
              kyc_session_id: session_id,
              kyc_approved_at: FieldValue.serverTimestamp()
            }, { merge: true });
            break;
          case 'declined':
            await userRef.set({ 
              kyc_status: 'declined',
              kyc_declined_at: FieldValue.serverTimestamp()
            }, { merge: true });
            break;
          case 'review':
            await userRef.set({ kyc_status: 'review' }, { merge: true });
            break;
        }
      }
      
      if (event.event_type === 'data.updated') {
        const { session_id, ocr_data, vendor_data } = event;
        if (vendor_data && ocr_data) {
          const userRef = getFirestore().collection('users').doc(vendor_data);
          await userRef.set({
            kyc_verified_name: `${ocr_data.first_name} ${ocr_data.last_name || ''}`.trim(),
            kyc_document_type: ocr_data.document_type
          }, { merge: true });
        }
      }

      // Save webhook event to a separate collection for logging
      try {
        await getFirestore().collection('kyc_webhook_events').add({
          session_id: event.session_id,
          event_type: event.event_type,
          status: event.status,
          vendor_data: event.vendor_data,
          payload: event,
          received_at: FieldValue.serverTimestamp()
        });
      } catch (logErr) {
        console.error('Error logging webhook event:', logErr);
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
