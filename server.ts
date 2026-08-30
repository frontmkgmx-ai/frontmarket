import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { initializeApp, App, cert } from 'firebase-admin/app';
import { getAuth as getFirebaseAuth } from 'firebase-admin/auth';
import { getFirestore as getFirebaseFirestore, FieldValue } from 'firebase-admin/firestore';

// Lazy Firebase Admin Initialization
let firebaseAdminApp: App | null = null;

function getFirebaseAdmin() {
  if (!firebaseAdminApp) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0736685342';
    
    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        firebaseAdminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || projectId,
        });
      } catch (err) {
        console.error('Error parsing FIREBASE_SERVICE_ACCOUNT JSON', err);
        throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON');
      }
    } else {
      // Fallback for AI Studio preview environment where default credentials might work if ADC is present
      // or we just initialize with projectId (Firestore can sometimes work with default credentials if the service account has access)
      firebaseAdminApp = initializeApp({
        projectId
      });
      console.log('[INFO] Initialized Firebase Admin without FIREBASE_SERVICE_ACCOUNT. This might fail if ADC is missing or lacks permissions.');
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

// --- Didit Webhook V3 Canonicalization Helpers ---
function shortenFloats(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shortenFloats);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shortenFloats(x)]),
    );
  }
  if (typeof v === "number" && !Number.isInteger(v) && v % 1 === 0) return Math.trunc(v);
  return v;
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.keys(v as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
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
    
    if (!process.env.DIDIT_API_KEY) {
      return res.status(500).json({ error: 'DIDIT_API_KEY not configured.' });
    }

    try {
      // Criar sessão Didit (V3 API)
      const response = await fetch('https://verification.didit.me/v3/session/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.DIDIT_API_KEY
        },
        body: JSON.stringify({
          workflow_id: process.env.DIDIT_WORKFLOW_ID || '6b43db1f-9cb7-48f1-a0a7-1941464fb1ca',
          vendor_data: user.uid,
          callback: `${process.env.APP_URL || 'https://frontmarket.cysmk.online'}/admin/verification/result`
        })
      });
      
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Didit API error: ${response.status} ${errBody}`);
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
      if (!process.env.DIDIT_API_KEY) {
        return res.status(500).json({ error: 'DIDIT_API_KEY not configured.' });
      }

      // Consultar Didit em tempo real (V3 API)
      const response = await fetch(
        `https://verification.didit.me/v3/session/${sessionId}/decision/`,
        { headers: { 'x-api-key': process.env.DIDIT_API_KEY } }
      );
      
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Didit API error: ${response.status} ${errBody}`);
      }
      
      const decision = await response.json();

      res.json({
        kyc_status: decision.status,         // "Approved" | "Declined" | "In Review" | ...
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
      const raw = req.body.toString();
      const sig = (req.headers['x-signature-v2'] || '') as string;
      const tsStr = req.headers['x-timestamp'] as string;
      const ts = Number(tsStr);

      // 1. Freshness (replay protection) - reject if older/newer than 300s
      if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) {
        return res.status(401).json({ error: 'stale' });
      }

      const secret = process.env.DIDIT_WEBHOOK_SECRET;
      let parsed: any = {};
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        return res.status(400).json({ error: 'invalid json' });
      }

      if (secret) {
        // 2. Canonicalise
        const canonical = JSON.stringify(sortKeys(shortenFloats(parsed)));
        
        // 3. Constant-time HMAC-SHA256
        const expected = crypto
          .createHmac('sha256', secret)
          .update(canonical, 'utf8')
          .digest('hex');
          
        if (
          sig.length !== expected.length ||
          !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
        ) {
          return res.status(401).json({ error: 'bad sig' });
        }
      } else {
        console.log('[INFO] DIDIT_WEBHOOK_SECRET not set, skipping signature verification');
      }

      // 4. Processar a decisão (V3 status)
      const { status, vendor_data, session_id } = parsed;
      const userId = vendor_data;

      if (userId) {
        const userRef = getFirestore().collection('users').doc(userId);
        
        // Deep search helper for document number
        const findDocumentNumber = (obj: any): string | null => {
          if (!obj || typeof obj !== 'object') return null;
          if (obj.document_number) return obj.document_number;
          if (obj.personal_number) return obj.personal_number;
          for (const key of Object.keys(obj)) {
            const res = findDocumentNumber(obj[key]);
            if (res) return res;
          }
          return null;
        };

        switch (status) {
          case 'Approved': {
            const documentNumber = findDocumentNumber(parsed);
            let isDuplicate = false;
            
            if (documentNumber) {
              const snapshot = await getFirestore().collection('users').where('kyc_cpf', '==', documentNumber).get();
              const existingUsers = snapshot.docs.filter(doc => doc.id !== userId && doc.data().kyc_status === 'approved');
              if (existingUsers.length > 0) {
                isDuplicate = true;
              }
            }

            if (isDuplicate) {
              await userRef.set({ 
                kyc_status: 'declined',
                kyc_error: 'Este CPF já está em uso por outra conta verificada.',
                kyc_declined_at: FieldValue.serverTimestamp()
              }, { merge: true });
            } else {
              await userRef.set({ 
                kyc_status: 'approved', 
                kyc_session_id: session_id,
                ...(documentNumber && { kyc_cpf: documentNumber }),
                kyc_approved_at: FieldValue.serverTimestamp()
              }, { merge: true });
            }
            break;
          }
          case 'Declined':
            await userRef.set({ 
              kyc_status: 'declined',
              kyc_declined_at: FieldValue.serverTimestamp()
            }, { merge: true });
            break;
          case 'In Review':
            await userRef.set({ kyc_status: 'review' }, { merge: true });
            break;
          case 'Resubmitted':
          case 'Kyc Expired':
            await userRef.set({ kyc_status: 'started' }, { merge: true });
            break;
          default:
            // "Not Started", "In Progress", "Awaiting User", "Abandoned", "Expired"
            break;
        }
      }

      // Save webhook event to a separate collection for logging
      try {
        await getFirestore().collection('kyc_webhook_events').add({
          session_id: parsed.session_id || parsed.id,
          status: parsed.status,
          vendor_data: parsed.vendor_data,
          payload: parsed,
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
