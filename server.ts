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
  app.use('/api', (req, res, next) => {
    if (req.path === '/webhook/didit' || req.path === '/webhooks/didit') {
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
        return res.json({ kyc_status: 'approved', session_id: sessionId });
      }

      // Consultar Didit em tempo real (V3 API)
      const response = await fetch(
        `https://verification.didit.me/v3/session/${sessionId}/decision/`,
        { headers: { 'x-api-key': process.env.DIDIT_API_KEY } }
      );
      
      if (!response.ok) {
        const errBody = await response.text();
        console.warn(`Didit API warning (${response.status}):`, errBody);
        return res.json({ kyc_status: 'pending', session_id: sessionId });
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
      res.json({ kyc_status: 'pending', session_id: sessionId });
    }
  });

  // Consolidated session query endpoint for frontend hooks
  app.get('/api/didit/session', async (req, res) => {
    const vendorData = req.query.vendor_data as string;
    const sessionId = req.query.session_id as string;

    try {
      const db = getFirestore();
      let userKycStatus: string | null = null;
      let userData: any = null;

      if (vendorData) {
        const userDoc = await db.collection('users').doc(vendorData).get();
        if (userDoc.exists) {
          userData = userDoc.data();
          userKycStatus = userData?.kyc_status;
        }
      }

      // Se já está aprovado no Firestore, retorne imediatamente
      if (userKycStatus && userKycStatus.toLowerCase() === 'approved') {
        return res.json({
          status: 'approved',
          session_id: sessionId || userData?.kyc_session_id,
          verified: true,
          document_data: userData?.kyc_decision || null
        });
      }

      // Se temos session_id e DIDIT_API_KEY, tenta consultar a Didit
      if (sessionId && process.env.DIDIT_API_KEY) {
        try {
          const response = await fetch(
            `https://verification.didit.me/v3/session/${sessionId}/decision/`,
            { headers: { 'x-api-key': process.env.DIDIT_API_KEY } }
          );

          if (response.ok) {
            const decision = await response.json();
            return res.json({
              status: decision.status || userKycStatus || 'pending',
              session_id: sessionId,
              verified: decision.status?.toLowerCase() === 'approved',
              document_data: decision.features?.ocr || null
            });
          }
        } catch (apiErr) {
          console.warn('Didit live check notice:', apiErr);
        }
      }

      return res.json({
        status: userKycStatus || 'not_started',
        session_id: sessionId || userData?.kyc_session_id || null,
        verified: userKycStatus?.toLowerCase() === 'approved'
      });
    } catch (err: any) {
      console.error('Error in /api/didit/session:', err);
      res.json({
        status: 'not_started',
        error: err.message
      });
    }
  });

  // Helper for timing-safe signature comparison
  function safeCompareHex(expectedHex: string, receivedHex: string): boolean {
    if (!expectedHex || !receivedHex) return false;
    const expectedBuf = Buffer.from(expectedHex.toLowerCase(), 'utf8');
    const receivedBuf = Buffer.from(receivedHex.toLowerCase(), 'utf8');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  }

  // Deep search helper for document number / CPF in Didit V3 objects
  const extractDocumentNumber = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    if (typeof obj.document_number === 'string' && obj.document_number.trim()) return obj.document_number.trim();
    if (typeof obj.personal_number === 'string' && obj.personal_number.trim()) return obj.personal_number.trim();
    if (typeof obj.id_number === 'string' && obj.id_number.trim()) return obj.id_number.trim();
    if (typeof obj.tax_id === 'string' && obj.tax_id.trim()) return obj.tax_id.trim();
    if (typeof obj.cpf === 'string' && obj.cpf.trim()) return obj.cpf.trim();
    for (const key of Object.keys(obj)) {
      const res = extractDocumentNumber(obj[key]);
      if (res) return res;
    }
    return null;
  };

  // Helper to extract verified name from OCR/id_verifications
  const extractVerifiedName = (payload: any): string | null => {
    const decision = payload.decision || payload;
    // 1. Check direct decision features
    if (decision.features?.ocr?.first_name) {
      return `${decision.features.ocr.first_name} ${decision.features.ocr.last_name || ''}`.trim();
    }
    // 2. Check id_verifications array (V3 schema)
    if (Array.isArray(decision.id_verifications) && decision.id_verifications.length > 0) {
      for (const item of decision.id_verifications) {
        if (item.features?.ocr?.first_name) {
          return `${item.features.ocr.first_name} ${item.features.ocr.last_name || ''}`.trim();
        }
        if (item.first_name) {
          return `${item.first_name} ${item.last_name || ''}`.trim();
        }
      }
    }
    return null;
  };

  // --- DIDIT WEBHOOK RECEIVER (V3 Real-Time Events) ---
  const handleDiditWebhook = async (req: express.Request, res: express.Response) => {
    const rawBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '', 'utf8');
    const rawStr = rawBuffer.toString('utf8');
    
    // Header signatures
    const sigV2 = (req.headers['x-signature-v2'] || '') as string;
    const sigRaw = (req.headers['x-signature'] || '') as string;
    const sigSimple = (req.headers['x-signature-simple'] || '') as string;
    const tsStr = (req.headers['x-timestamp'] || '') as string;
    const ts = Number(tsStr);
    const nowEpoch = Math.floor(Date.now() / 1000);

    // 1. Validate timestamp freshness (within 5 minutes = 300 seconds)
    if (!ts || isNaN(ts) || Math.abs(nowEpoch - ts) > 300) {
      console.warn(`[DIDIT WEBHOOK] Stale or missing timestamp. Now: ${nowEpoch}, Header: ${tsStr}`);
      return res.status(401).json({ error: 'stale_timestamp', message: 'Webhook timestamp is outside the 5-minute freshness window' });
    }

    // 2. Parse JSON payload
    let payload: any = {};
    try {
      payload = JSON.parse(rawStr);
    } catch (e) {
      console.error('[DIDIT WEBHOOK] Invalid JSON body:', rawStr.slice(0, 200));
      return res.status(400).json({ error: 'invalid_json', message: 'Malformed JSON payload' });
    }

    const secret = process.env.DIDIT_WEBHOOK_SECRET;

    // 3. Verify HMAC-SHA256 signature using constant-time comparison
    if (secret) {
      let isVerified = false;
      let usedMethod = '';

      // Priority 1: X-Signature-V2 (over canonical sorted JSON)
      if (sigV2) {
        const canonical = JSON.stringify(sortKeys(shortenFloats(payload)));
        const expectedV2 = crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
        if (safeCompareHex(expectedV2, sigV2)) {
          isVerified = true;
          usedMethod = 'X-Signature-V2';
        }
      }

      // Priority 2: X-Signature (over raw bytes)
      if (!isVerified && sigRaw) {
        const expectedRaw = crypto.createHmac('sha256', secret).update(rawBuffer).digest('hex');
        if (safeCompareHex(expectedRaw, sigRaw)) {
          isVerified = true;
          usedMethod = 'X-Signature';
        }
      }

      // Priority 3: X-Signature-Simple ({timestamp}:{session_id}:{status}:{webhook_type})
      if (!isVerified && sigSimple) {
        const sessionIdVal = payload.session_id || payload.id || '';
        const statusVal = payload.status || '';
        const webhookTypeVal = payload.webhook_type || '';
        const simpleString = `${ts}:${sessionIdVal}:${statusVal}:${webhookTypeVal}`;
        const expectedSimple = crypto.createHmac('sha256', secret).update(simpleString, 'utf8').digest('hex');
        if (safeCompareHex(expectedSimple, sigSimple)) {
          isVerified = true;
          usedMethod = 'X-Signature-Simple';
        }
      }

      if (!isVerified) {
        console.error('[DIDIT WEBHOOK] Signature verification failed. Headers:', {
          sigV2: sigV2 ? 'present' : 'missing',
          sigRaw: sigRaw ? 'present' : 'missing',
          sigSimple: sigSimple ? 'present' : 'missing',
          timestamp: tsStr
        });
        return res.status(401).json({ error: 'invalid_signature', message: 'HMAC signature verification failed' });
      } else {
        console.log(`[DIDIT WEBHOOK] Verified successfully via ${usedMethod}`);
      }
    } else {
      console.log('[DIDIT WEBHOOK] Notice: DIDIT_WEBHOOK_SECRET not configured, bypassing signature check');
    }

    // 4. Extract envelope details & ensure idempotency
    const eventId = payload.event_id || `${payload.session_id || payload.id || 'evt'}_${payload.status || 'status'}_${payload.webhook_type || 'event'}_${payload.timestamp || ts}`;
    const webhookType = (payload.webhook_type || 'status.updated').toLowerCase();
    const status = payload.status || '';
    const sessionId = payload.session_id || payload.id || null;
    const vendorData = payload.vendor_data || payload.metadata?.userId || payload.metadata?.user_id || null;
    const decision = payload.decision || {};

    // 5. Return 200 OK immediately as required by Didit
    res.status(200).json({ received: true, event_id: eventId });

    // 6. Process database updates asynchronously and idempotently
    try {
      const db = getFirestore();
      const eventDocRef = db.collection('kyc_webhook_events').doc(eventId);
      const existingEvent = await eventDocRef.get();

      if (existingEvent.exists) {
        console.log(`[DIDIT WEBHOOK] Idempotent skip: Event ${eventId} was already processed.`);
        return;
      }

      // Log event to Firestore
      await eventDocRef.set({
        event_id: eventId,
        session_id: sessionId,
        webhook_type: webhookType,
        status: status,
        vendor_data: vendorData,
        application_id: payload.application_id || null,
        workflow_id: payload.workflow_id || null,
        created_at_epoch: payload.created_at || payload.timestamp || ts,
        received_at: FieldValue.serverTimestamp(),
        payload: payload
      });

      // Find user to update
      let targetUserId = vendorData;
      if (!targetUserId && sessionId) {
        const userQuery = await db.collection('users').where('kyc_session_id', '==', sessionId).limit(1).get();
        if (!userQuery.empty) {
          targetUserId = userQuery.docs[0].id;
        }
      }

      if (!targetUserId) {
        console.log(`[DIDIT WEBHOOK] Event ${eventId} (${webhookType}) received for unlinked session ${sessionId}`);
        return;
      }

      const userRef = db.collection('users').doc(targetUserId);

      // Handle events by webhook_type
      switch (webhookType) {
        case 'status.updated':
        case 'data.updated':
        case 'user.status.updated':
        case 'user.data.updated':
        case 'business.status.updated':
        case 'business.data.updated': {
          const statusLower = status.toLowerCase();

          if (status === 'Approved' || statusLower === 'approved') {
            const documentNumber = extractDocumentNumber(payload);
            const verifiedName = extractVerifiedName(payload);
            let isDuplicateCpf = false;

            if (documentNumber) {
              const duplicateCheck = await db.collection('users')
                .where('kyc_cpf', '==', documentNumber)
                .get();
              
              const existingVerified = duplicateCheck.docs.filter(
                d => d.id !== targetUserId && (d.data().kyc_status === 'approved' || d.data().verified === true)
              );

              if (existingVerified.length > 0) {
                isDuplicateCpf = true;
              }
            }

            if (isDuplicateCpf) {
              await userRef.set({
                verified: false,
                verification_status: 'declined',
                kyc_status: 'declined',
                kyc_error: 'Este CPF já está em uso por outra conta verificada.',
                kyc_declined_at: FieldValue.serverTimestamp(),
                kyc_last_event_id: eventId
              }, { merge: true });
              console.warn(`[DIDIT KYC] CPF duplication blocked for user ${targetUserId} (CPF: ${documentNumber})`);
            } else {
              await userRef.set({
                verified: true,
                verification_status: 'approved',
                kyc_status: 'approved',
                kyc_session_id: sessionId,
                ...(documentNumber && { kyc_cpf: documentNumber }),
                ...(verifiedName && { verified_name: verifiedName }),
                kyc_approved_at: FieldValue.serverTimestamp(),
                kyc_error: null,
                kyc_last_event_id: eventId,
                kyc_decision: {
                  status: status,
                  verified_name: verifiedName,
                  document_number: documentNumber,
                  updated_at: new Date().toISOString()
                }
              }, { merge: true });
              console.log(`[DIDIT KYC] User ${targetUserId} verified and approved successfully.`);
            }
          } else if (status === 'Declined' || statusLower === 'declined') {
            const warnings = decision.warnings || decision.reviews || [];
            await userRef.set({
              verified: false,
              verification_status: 'declined',
              kyc_status: 'declined',
              kyc_declined_at: FieldValue.serverTimestamp(),
              kyc_warnings: warnings,
              kyc_last_event_id: eventId
            }, { merge: true });
            console.log(`[DIDIT KYC] User ${targetUserId} marked as Declined.`);
          } else if (status === 'In Review' || statusLower === 'in review' || statusLower === 'in_review') {
            await userRef.set({
              verification_status: 'pending_review',
              kyc_status: 'review',
              kyc_last_event_id: eventId
            }, { merge: true });
          } else if (status === 'In Progress' || statusLower === 'in progress' || statusLower === 'in_progress') {
            await userRef.set({
              verification_status: 'in_progress',
              kyc_status: 'in_progress',
              kyc_last_event_id: eventId
            }, { merge: true });
          } else if (status === 'Resubmitted' || statusLower === 'resubmitted') {
            await userRef.set({
              verification_status: 'resubmitted',
              kyc_status: 'started',
              kyc_last_event_id: eventId
            }, { merge: true });
          } else if (status === 'Abandoned' || statusLower === 'abandoned') {
            await userRef.set({
              verification_status: 'abandoned',
              kyc_status: 'abandoned',
              kyc_last_event_id: eventId
            }, { merge: true });
          } else if (status === 'Expired' || status === 'KYC Expired' || statusLower.includes('expired')) {
            await userRef.set({
              verification_status: 'expired',
              kyc_status: 'expired',
              kyc_last_event_id: eventId
            }, { merge: true });
          } else if (status === 'Not Started' || statusLower === 'not_started' || statusLower === 'not started') {
            await userRef.set({
              verification_status: 'not_started',
              kyc_status: 'not_started',
              kyc_last_event_id: eventId
            }, { merge: true });
          }
          break;
        }

        case 'activity.created': {
          // Log user timeline activity if present
          if (targetUserId) {
            await db.collection('users').doc(targetUserId).collection('kyc_activities').add({
              event_id: eventId,
              session_id: sessionId,
              activity: payload.activity || payload,
              created_at: FieldValue.serverTimestamp()
            });
          }
          break;
        }

        case 'transaction.created':
        case 'transaction.status.updated': {
          // Log transaction KYC review event
          if (targetUserId) {
            await db.collection('users').doc(targetUserId).collection('kyc_transactions').doc(payload.transaction_id || eventId).set({
              event_id: eventId,
              session_id: sessionId,
              transaction: payload.transaction || payload,
              updated_at: FieldValue.serverTimestamp()
            }, { merge: true });
          }
          break;
        }

        default:
          console.log(`[DIDIT WEBHOOK] Unhandled event family: ${webhookType}`);
          break;
      }
    } catch (asyncErr) {
      console.error('[DIDIT WEBHOOK] Error executing asynchronous updates:', asyncErr);
    }
  };

  // Bind Webhook receiver to both standard /api/webhooks/didit and /api/webhook/didit with express.raw
  app.post(['/api/webhook/didit', '/api/webhooks/didit'], express.raw({ type: '*/*' }), handleDiditWebhook);

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
