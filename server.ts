import fs from 'fs';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { initializeApp, App, cert } from 'firebase-admin/app';
import { getAuth as getFirebaseAuth } from 'firebase-admin/auth';
import { getFirestore as getFirebaseFirestore, FieldValue } from 'firebase-admin/firestore';
import { setupStreamxRoutes } from './server-streamx.js';
import { setupMisticPayRoutes } from './server-misticpay.js';
import { setupWalletRoutes } from "./server-wallet.js";
import { startD3Scheduler } from './server-d3-scheduler.js';
import { startEmailRetryScheduler } from './server-email-retry.js';
import { setupKycRoutes } from './server-kyc-routes.js';
import { setupCustomerAuthRoutes } from './server-customer-auth.js';
import { setupResendRoutes } from './server-resend.js';
import { setupPublicStoreRoutes } from './server-public-store.js';


import { getAdminDb, getFirebaseAdmin } from './server-firebase-admin.js';
const getFirestore = getAdminDb;

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
  // Permitir configuração de porta dinâmica (ex: Railway, Render) ou porta 3000 (Padrão)
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Remoção de fingerprinting de servidor
  app.disable('x-powered-by');

  // Headers de Segurança Globais
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Políticas estritas de Não-Armazenamento de Cache para todas as rotas de API
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  // Use JSON parser for all routes EXCEPT webhook endpoints which require raw body parsing
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/webhook/') || req.path.startsWith('/webhooks/')) {
      next(); // skip standard JSON body parsing for all webhooks
    } else {
      express.json({ limit: '10mb' })(req, res, next);
    }
  });

  // Health check
  
  app.post('/api/admin/test-email', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      const { getFirebaseAdmin } = await import('./server-firebase-admin.js');
      const admin = getFirebaseAdmin();
      const { getAuth } = await import('firebase-admin/auth');
      const decodedToken = await getAuth(admin).verifyIdToken(token);
      
      // Ensure the user has admin role or stores
      const { getAdminDb } = await import('./server-firebase-admin.js');
      const db = getAdminDb();
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      if (!userDoc.exists) return res.status(403).json({ error: 'Usuário não encontrado' });
      
      const { to } = req.body;
      if (!to || !to.includes('@')) return res.status(400).json({ error: 'E-mail inválido' });
      
      const { sendEmail } = await import('./server-email.js');
      const result = await sendEmail({
        to,
        subject: 'Teste de Configuração Resend',
        html: '<p>Este é um e-mail de teste do sistema de notificações da loja.</p>',
        text: 'Este é um e-mail de teste do sistema de notificações da loja.'
      });
      
      if (result.success) {
        res.json({ success: true, provider: 'resend', messageId: result.providerMessageId });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (err: any) {
      console.error('[Test Email] Error:', err.message);
      res.status(500).json({ error: 'Internal server error', details: err.message, stack: err.stack });
    }
  });

  // Endpoint auxiliar para REENVIAR email de pedido pelo painel (Fluxo B)
  app.post('/api/orders/:storeId/:orderId/trigger-email', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado. Token ausente.' });
      }

      const token = authHeader.split('Bearer ')[1];
      const { getFirebaseAdmin, getAdminDb } = await import('./server-firebase-admin.js');
      const admin = getFirebaseAdmin();
      const { getAuth } = await import('firebase-admin/auth');
      const decodedToken = await getAuth(admin).verifyIdToken(token);

      const { storeId, orderId } = req.params;

      // 1-2. Autenticar vendedor e validar acesso à store
      const db = getAdminDb();
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();

      const userStores = userData?.stores || [];
      if (!userStores.includes(storeId)) {
         return res.status(403).json({ error: 'Acesso negado à loja.' });
      }

      // 3. Buscar o pedido
      const orderRef = db.collection('stores').doc(storeId).collection('orders').doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) {
        return res.status(404).json({ error: 'Pedido não encontrado.' });
      }
      const orderData = orderSnap.data();

      // 5. Localizar o campo REAL de e-mail do comprador
      const customerEmail = orderData?.customer?.email || orderData?.customerEmail;
      
      // 6. Validar o email
      if (!customerEmail || typeof customerEmail !== 'string' || !customerEmail.includes('@')) {
        return res.status(422).json({ error: 'Pedido não possui e-mail de comprador válido.' });
      }

      // 7. Montar o conteúdo usando dados persistidos
      // First get store settings
      const settingsSnap = await db.collection('stores').doc(storeId).collection('settings').doc('emails').get();
      const settings = settingsSnap.exists ? settingsSnap.data() : null;
      if (!settings || !settings.statusEmails) {
        return res.status(422).json({ error: 'Loja não possui e-mails configurados.' });
      }

      const status = orderData?.status || 'paid';
      const statusConfig = settings.statusEmails[status];
      
      const escapeHtml = (unsafe) => {
        return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      };

      const customerName = orderData?.customer?.name || orderData?.customerName || 'Cliente';
      const storeSnap = await db.collection('stores').doc(storeId).get();
      const storeName = storeSnap.exists ? (storeSnap.data().name || 'Loja') : 'Loja';
      const totalAmount = orderData?.total != null ? `R$ ${Number(orderData.total).toFixed(2).replace('.', ',')}` : '';

      const replaceVars = (text) => {
        if (!text) return '';
        return text
          .replace(/{\{customer_name\}\}/g, escapeHtml(customerName))
          .replace(/{\{order_id\}\}/g, escapeHtml(orderId))
          .replace(/{\{store_name\}\}/g, escapeHtml(storeName))
          .replace(/{\{total_amount\}\}/g, escapeHtml(totalAmount));
      };

      // 8. Call sendEmail
      const { sendEmail } = await import('./server-email.js');
      const results = [];
      const { FieldValue } = await import('firebase-admin/firestore');

      // Send status email
      if (statusConfig && statusConfig.enabled) {
        const subject = replaceVars(statusConfig.subject);
        const body = replaceVars(statusConfig.body);
        const { generateEmailHtml } = await import('./server-email-template.js');
        const htmlBody = generateEmailHtml(body, settings.templateConfig, storeName);
        
        const deliveryId = db.collection('email_deliveries').doc().id;
        const deliveryRef = db.collection('email_deliveries').doc(deliveryId);
        
        await deliveryRef.set({
          id: deliveryId,
          type: 'order_resend',
          storeId,
          orderId,
          triggeredBy: decodedToken.uid,
          to: customerEmail,
          subject,
          html: htmlBody,
          text: body,
          status: 'queued',
          createdAt: FieldValue.serverTimestamp()
        });

        const emailRes = await sendEmail({
          to: customerEmail,
          subject,
          html: htmlBody,
          text: body
        });

        await deliveryRef.update({
          status: emailRes.success ? 'sent' : 'failed',
          provider: 'resend',
          providerMessageId: emailRes.providerMessageId || null,
          lastErrorCode: emailRes.error ? String(emailRes.error) : null,
          lastErrorMessage: emailRes.error ? String(emailRes.error) : null,
          sentAt: emailRes.success ? FieldValue.serverTimestamp() : null,
          updatedAt: FieldValue.serverTimestamp()
        });
        
        results.push(emailRes);
      }
      
      // Also send product emails if paid
      if (status === 'paid' && settings.productEmails && orderData.items && orderData.items.length > 0) {
        for (const item of orderData.items) {
          const prodId = item.productId;
          const prodEmailRules = settings.productEmails.filter(p => p.productId === prodId && p.enabled);
          for (const rule of prodEmailRules) {
            const prodSubject = replaceVars(rule.subject).replace(/{\{product_name\}\}/g, escapeHtml(item.name || 'Produto'));
            const prodBody = replaceVars(rule.body).replace(/{\{product_name\}\}/g, escapeHtml(item.name || 'Produto'));
            const { generateEmailHtml } = await import('./server-email-template.js');
            const prodHtml = generateEmailHtml(prodBody, settings.templateConfig, storeName);
            
            const deliveryId = db.collection('email_deliveries').doc().id;
            const deliveryRef = db.collection('email_deliveries').doc(deliveryId);
            await deliveryRef.set({
              id: deliveryId,
              type: 'order_resend',
              storeId,
              orderId,
              triggeredBy: decodedToken.uid,
              to: customerEmail,
              subject: prodSubject,
              html: prodHtml,
              text: prodBody,
              status: 'queued',
              createdAt: FieldValue.serverTimestamp()
            });

            const emailRes = await sendEmail({
              to: customerEmail,
              subject: prodSubject,
              html: prodHtml,
              text: prodBody
            });

            await deliveryRef.update({
              status: emailRes.success ? 'sent' : 'failed',
              provider: 'resend',
              providerMessageId: emailRes.providerMessageId || null,
              lastErrorCode: emailRes.error ? String(emailRes.error) : null,
              lastErrorMessage: emailRes.error ? String(emailRes.error) : null,
              sentAt: emailRes.success ? FieldValue.serverTimestamp() : null,
              updatedAt: FieldValue.serverTimestamp()
            });
            results.push(emailRes);
          }
        }
      }

      if (results.length === 0) {
        return res.status(400).json({ error: 'Nenhuma regra de e-mail ativada para este pedido.' });
      }

      const allSuccess = results.every(r => r.success);
      if (allSuccess) {
        res.json({ success: true, results });
      } else {
        const getSafeError = (err: any) => (err && typeof err === 'object' && err.message) ? err.message : String(err);
        const errors = results.filter(r => !r.success).map(r => getSafeError(r.error));
        res.status(500).json({ error: 'Falha parcial ou total no envio.', details: errors });
      }

    } catch (err) {
      console.error('[Trigger Email] Erro:', err);
      const safeError = (err && typeof err === 'object' && (err as any).message) ? (err as any).message : String(err);
      res.status(500).json({ error: 'Erro ao disparar email', details: safeError });
    }
  });

  // Fluxo A - ENVIAR E-MAIL DE TESTE
  app.post('/api/stores/:storeId/test-email-template', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const token = authHeader.split('Bearer ')[1];
      const { getFirebaseAdmin, getAdminDb } = await import('./server-firebase-admin.js');
      const admin = getFirebaseAdmin();
      const { getAuth } = await import('firebase-admin/auth');
      const decodedToken = await getAuth(admin).verifyIdToken(token);

      const { storeId } = req.params;
      const db = getAdminDb();
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();

      const userStores = userData?.stores || [];
      if (!userStores.includes(storeId)) {
         return res.status(403).json({ error: 'Acesso negado à loja.' });
      }

      // Vendedor é o destino fixo do teste
      const sellerEmail = userData?.email;
      if (!sellerEmail || typeof sellerEmail !== 'string' || !sellerEmail.includes('@')) {
        return res.status(400).json({ error: 'E-mail do vendedor não encontrado.' });
      }

      const { subject: rawSubject, body: rawBody } = req.body;
      
      const escapeHtml = (unsafe) => {
        return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      };

      const replaceVars = (text) => {
        if (!text) return '';
        return text
          .replace(/\{\{customer_name\}\}/g, escapeHtml("João Teste"))
          .replace(/\{\{order_id\}\}/g, escapeHtml("TEST-1234"))
          .replace(/\{\{product_name\}\}/g, escapeHtml("Produto de Teste"))
          .replace(/\{\{store_name\}\}/g, escapeHtml("Minha Loja"))
          .replace(/\{\{total_amount\}\}/g, escapeHtml("R$ 99,90"));
      };

      const subject = replaceVars(rawSubject);
      const body = replaceVars(rawBody);
      const settingsSnap = await db.collection('stores').doc(storeId).collection('settings').doc('emails').get();
      const settings = settingsSnap.exists ? settingsSnap.data() : null;
      const storeSnap = await db.collection('stores').doc(storeId).get();
      const storeName = storeSnap.exists ? (storeSnap.data().name || 'Loja') : 'Loja';
      
      const { generateEmailHtml } = await import('./server-email-template.js');
      const htmlBody = generateEmailHtml(body, settings?.templateConfig, storeName);

      const { FieldValue } = await import('firebase-admin/firestore');
      const deliveryId = db.collection('email_deliveries').doc().id;
      const deliveryRef = db.collection('email_deliveries').doc(deliveryId);
      
      await deliveryRef.set({
        id: deliveryId,
        type: 'test',
        storeId,
        triggeredBy: decodedToken.uid,
        to: sellerEmail,
        subject,
        html: htmlBody,
        text: body,
        status: 'queued',
        createdAt: FieldValue.serverTimestamp()
      });

      const { sendEmail } = await import('./server-email.js');
      const result = await sendEmail({
        to: sellerEmail,
        subject,
        html: htmlBody,
        text: body
      });

      await deliveryRef.update({
        status: result.success ? 'sent' : 'failed',
        provider: 'resend',
        providerMessageId: result.providerMessageId || null,
        lastErrorCode: result.error ? String(result.error) : null,
        lastErrorMessage: result.error ? String(result.error) : null,
        sentAt: result.success ? FieldValue.serverTimestamp() : null,
        updatedAt: FieldValue.serverTimestamp()
      });

      if (result.success) {
        res.json({ success: true, provider: 'resend', messageId: result.providerMessageId });
      } else {
        const errObj = result.error as any; const safeError = errObj ? (typeof errObj === 'object' && errObj.message ? errObj.message : String(errObj)) : 'Unknown Error';
        res.status(500).json({ error: safeError });
      }
    } catch (err) {
      console.error('[Test Email Template] Error:', err);
      const safeError = (err && typeof err === 'object' && (err as any).message) ? (err as any).message : String(err);
      res.status(500).json({ error: 'Internal server error', details: safeError });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Normalizador robusto da URL base da aplicação para garantir esquemas obrigatórios (https://)
  function getAppBaseUrl(req?: express.Request): string {
    let rawUrl = (process.env.APP_URL || '').trim();
    if (!rawUrl && req) {
      const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https') as string;
      const host = (req.headers['x-forwarded-host'] || req.headers.host || 'marketplace.frontmk.online') as string;
      rawUrl = `${proto}://${host}`;
    }
    if (!rawUrl) {
      rawUrl = 'https://marketplace.frontmk.online';
    }
    // Garante obrigatoriamente que a URL tenha esquema https:// ou http://
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      rawUrl = `https://${rawUrl}`;
    }
    return rawUrl.replace(/\/+$/, '');
  }

  // Gateway Financeiro Unificado: MisticPay & Carteira
  setupStreamxRoutes(app, authMiddleware);
  setupMisticPayRoutes(app, authMiddleware, getFirestore);
  setupWalletRoutes(app, authMiddleware, getFirestore);
  startD3Scheduler(getFirestore);
  startEmailRetryScheduler();

  // Módulo Oficial Canônico de KYC (Didit v3)
  setupKycRoutes(app, authMiddleware, getFirestore);

  // Módulo Seguro de Autenticação de Clientes da Vitrine (scrypt / Zero-Plaintext)
  setupCustomerAuthRoutes(app, getFirestore);
  setupResendRoutes(app);
  setupPublicStoreRoutes(app);

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

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  const gracefulShutdown = () => {
    console.log('Recebido sinal de interrupção, iniciando graceful shutdown...');
    server.close(() => {
      console.log('Processo encerrado com segurança.');
      process.exit(0);
    });
    
    // Timeout para forçar o encerramento se demorar muito
    setTimeout(() => {
      console.error('Forçando encerramento após timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

startServer();
