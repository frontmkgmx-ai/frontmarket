import express from 'express';
import { WithdrawalService } from './server-withdrawal-service';

export function setupWalletRoutes(app: express.Express, authMiddleware: any, getDb: any) {
  app.post('/api/wallet/:storeId/withdraw', authMiddleware, async (req: express.Request, res: express.Response) => {
    try {
      const { storeId } = req.params;
      const { amount, pixKey, pixKeyType, idempotencyKey } = req.body;
      const uid = (req as any).user?.uid;

      if (!uid) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Não autorizado.' });
      }

      const db = getDb();
      const result = await WithdrawalService.processWithdrawal(
        {
          storeId,
          uid,
          amount: parseFloat(amount),
          pixKey,
          pixKeyType,
          idempotencyKey,
          gateway: 'misticpay'
        },
        db
      );

      if (!result.success) {
        const statusCode =
          result.code === 'FORBIDDEN' ? 403 :
          result.code === 'IDEMPOTENT_DUPLICATE' ? 409 :
          result.code === 'CONFIG_ERROR' ? 503 :
          result.code === 'GATEWAY_ERROR' ? 502 : 400;

        return res.status(statusCode).json(result);
      }

      return res.json(result);
    } catch (err: any) {
      console.error('[server-wallet] Erro não tratado:', err);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Ocorreu um erro interno ao processar a solicitação de saque.',
        details: err.message
      });
    }
  });
}

