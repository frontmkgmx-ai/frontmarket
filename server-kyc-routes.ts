import express from 'express';
import { KycService, normalizeKycStatus } from './server-kyc-service';

/**
 * Registra todas as rotas canônicas e seguras de KYC no Express.
 */
export function setupKycRoutes(
  app: express.Express,
  authMiddleware: express.RequestHandler,
  getFirestore: () => FirebaseFirestore.Firestore
) {
  // 1. Iniciar KYC (Exclusivamente autenticado via Firebase ID Token)
  app.post('/api/user/start-kyc', authMiddleware, async (req: express.Request, res: express.Response) => {
    try {
      const user = (req as any).user;
      if (!user || !user.uid) {
        return res.status(401).json({
          error: 'Usuário não autenticado.',
          code: 'AUTH_REQUIRED'
        });
      }

      // Normalizador da URL da aplicação
      let originUrl = (process.env.APP_URL || '').trim();
      if (!originUrl) {
        const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https') as string;
        const host = (req.headers['x-forwarded-host'] || req.headers.host || 'marketplace.frontmk.online') as string;
        originUrl = `${proto}://${host}`;
      }
      if (!originUrl.startsWith('http://') && !originUrl.startsWith('https://')) {
        originUrl = `https://${originUrl}`;
      }
      originUrl = originUrl.replace(/\/+$/, '');

      const db = getFirestore();
      const result = await KycService.startUserKyc(db, user.uid, originUrl);

      return res.status(200).json(result);
    } catch (err: any) {
      console.error('[KYC ROUTE] Erro em /api/user/start-kyc:', err.message);
      return res.status(err.statusCode || 500).json({
        error: err.message || 'Erro interno ao iniciar verificação de identidade.',
        code: err.code || 'KYC_START_ERROR'
      });
    }
  });

  // 2. Consultar Status KYC do Usuário Autenticado
  // Consulta EXCLUSIVAMENTE o status do próprio usuário (req.user.uid)
  app.get('/api/user/kyc-status', authMiddleware, async (req: express.Request, res: express.Response) => {
    try {
      const user = (req as any).user;
      if (!user || !user.uid) {
        return res.status(401).json({
          error: 'Usuário não autenticado.',
          code: 'AUTH_REQUIRED'
        });
      }

      const db = getFirestore();
      const statusData = await KycService.getUserKycStatus(db, user.uid);

      return res.status(200).json({
        ...statusData,
        // Campos legados para compatibilidade segura com telas existentes
        kyc_status: statusData.status,
        session_id: statusData.currentSessionId
      });
    } catch (err: any) {
      console.error('[KYC ROUTE] Erro em /api/user/kyc-status:', err.message);
      return res.status(err.statusCode || 500).json({
        error: 'Erro ao consultar status da verificação.',
        code: err.code || 'KYC_STATUS_ERROR'
      });
    }
  });

  // 3. Endpoint de compatibilidade para hooks antigos (/api/didit/session)
  // Agora protegido e com escopo restrito (sem vazamento de dados de outros usuários ou PII desnecessária)
  app.get('/api/didit/session', authMiddleware, async (req: express.Request, res: express.Response) => {
    try {
      const user = (req as any).user;
      if (!user || !user.uid) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }

      const db = getFirestore();
      const statusData = await KycService.getUserKycStatus(db, user.uid);

      return res.status(200).json({
        status: statusData.status,
        session_id: statusData.currentSessionId,
        verified: statusData.status === 'approved',
        canWithdraw: statusData.canWithdraw
      });
    } catch (err: any) {
      console.error('[KYC ROUTE] Erro em /api/didit/session:', err.message);
      return res.status(500).json({ error: 'Erro ao consultar sessão.' });
    }
  });

  // 4. Webhook Oficial Didit v3 (Idempotente, com HMAC e Fail-Closed)
  const webhookHandler = async (req: express.Request, res: express.Response) => {
    try {
      const rawBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '', 'utf8');
      const db = getFirestore();

      const result = await KycService.handleWebhook(db, rawBuffer, req.headers);
      return res.status(200).json(result);
    } catch (err: any) {
      console.error('[KYC WEBHOOK ROUTE] Erro no processamento do webhook:', err.message);
      return res.status(err.statusCode || 400).json({
        error: err.message || 'Webhook processing failed.',
        code: err.code || 'WEBHOOK_FAILED'
      });
    }
  };

  app.post('/api/webhook/didit', express.raw({ type: '*/*' }), webhookHandler);
  app.post('/api/webhooks/didit', express.raw({ type: '*/*' }), webhookHandler);
}
