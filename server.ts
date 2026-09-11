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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
