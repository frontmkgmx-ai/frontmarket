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
      const { getAuth } = require('firebase-admin/auth');
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
        res.status(500).json({ success: false, provider: 'resend', code: result.error });
      }
    } catch (err: any) {
      console.error('[Test Email] Error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Endpoint auxiliar para disparar emails ao atualizar status pelo painel
  app.post('/api/orders/:storeId/:orderId/trigger-email', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado. Token ausente.' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      const { getFirebaseAdmin, getAdminDb } = await import('./server-firebase-admin.js');
      const admin = getFirebaseAdmin();
      const { getAuth } = require('firebase-admin/auth');
      const decodedToken = await getAuth(admin).verifyIdToken(token);
      
      const { storeId, orderId } = req.params;
      
      // Verify store access
      const db = getAdminDb();
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();
      
      const userStores = userData?.stores || [];
      if (!userStores.includes(storeId)) {
         return res.status(403).json({ error: 'Acesso negado à loja.' });
      }

      const { status } = req.body;
      const { triggerOrderStatusEmail } = await import('./server-email-triggers.js');
      const { processEvent } = await import('./server-notification-service.js');
      
      // Run and await
      await Promise.all([
        triggerOrderStatusEmail(storeId, orderId, status),
        processEvent({
          eventId: 'STATUS_' + orderId + '_' + status,
          type: 'ORDER_STATUS_CHANGED',
          storeId,
          orderId,
          source: 'admin_panel',
          occurredAt: new Date().toISOString()
        })
      ]);

      res.json({ success: true });
    } catch (err) {
      console.error('[Trigger Email] Erro:', err);
      res.status(500).json({ error: 'Erro ao disparar email' });
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
