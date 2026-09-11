import express from 'express';
import crypto from 'crypto';
import { FinancialWalletService } from './server-financial-service';

export function setupWalletRoutes(app: express.Express, authMiddleware: any, getDb: any) {
  /**
   * GET /api/finances/:storeId
   * Retorna os saldos consolidados em centavos e reais, além dos saques e extrato do ledger.
   */
  app.get('/api/finances/:storeId', authMiddleware, async (req: express.Request, res: express.Response) => {
    const requestId = crypto.randomUUID();
    try {
      const { storeId } = req.params;
      const uid = (req as any).user?.uid;

      if (!uid) {
        return res.status(401).json({
          success: false,
          code: 'AUTH_REQUIRED',
          message: 'Autenticação necessária para consultar a carteira.',
          requestId
        });
      }

      const db = getDb();
      const storeDoc = await db.collection('stores').doc(storeId).get();

      if (!storeDoc.exists) {
        return res.status(404).json({
          success: false,
          code: 'STORE_NOT_FOUND',
          message: 'Loja não encontrada.',
          requestId
        });
      }

      if (storeDoc.data().ownerId !== uid) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Acesso negado. Apenas o proprietário da loja pode visualizar a carteira.',
          requestId
        });
      }

      const details = await FinancialWalletService.getWalletDetails(db, storeId);

      return res.json({
        success: true,
        storeId,
        requestId,
        ...details
      });
    } catch (err: any) {
      console.error(`[server-wallet] Erro ao consultar carteira (req: ${requestId}):`, err.message);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Ocorreu um erro interno ao carregar a carteira.',
        requestId
      });
    }
  });

  /**
   * POST /api/finances/:storeId/withdraw
   * Solicita um saque com proteção de concorrência, invariantes financeiras e idempotência estrita.
   */
  app.post('/api/finances/:storeId/withdraw', authMiddleware, async (req: express.Request, res: express.Response) => {
    const requestId = crypto.randomUUID();
    try {
      const { storeId } = req.params;
      const { amount, amountCents: rawAmountCents, pixKey, pixKeyType, idempotencyKey } = req.body;
      const uid = (req as any).user?.uid;

      if (!uid) {
        return res.status(401).json({
          success: false,
          code: 'AUTH_REQUIRED',
          message: 'Autenticação necessária para solicitar saque.',
          requestId
        });
      }

      // Validação estrita de Idempotência
      if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: 'A chave de idempotência (idempotencyKey) é obrigatória para operações financeiras.',
          requestId
        });
      }

      const cleanIdempotencyKey = idempotencyKey.trim();
      const validKeyRegex = /^[a-zA-Z0-9_-]{8,128}$/;
      if (!validKeyRegex.test(cleanIdempotencyKey)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Formato de chave de idempotência inválido (deve conter entre 8 e 128 caracteres alfanuméricos, hífen ou sublinhado).',
          requestId
        });
      }

      // Validação do valor em centavos
      let finalAmountCents = 0;
      if (typeof rawAmountCents === 'number' && Number.isInteger(rawAmountCents)) {
        finalAmountCents = rawAmountCents;
      } else if (amount !== undefined && amount !== null) {
        finalAmountCents = Math.round(Number(amount) * 100);
      }

      if (isNaN(finalAmountCents) || finalAmountCents < FinancialWalletService.MIN_WITHDRAW_CENTS) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_AMOUNT',
          message: 'O valor mínimo para solicitação de saque é de R$ 20,00.',
          requestId
        });
      }

      const db = getDb();
      const result = await FinancialWalletService.processWithdrawal(
        {
          storeId,
          uid,
          amountCents: finalAmountCents,
          pixKey,
          pixKeyType,
          idempotencyKey: cleanIdempotencyKey,
          gateway: 'misticpay',
          requestId,
          requestHost: req.get('x-forwarded-host') || req.get('host')
        },
        db
      );

      if (!result.success) {
        const statusCode =
          result.code === 'FORBIDDEN' || result.code === 'KYC_REQUIRED' ? 403 :
          result.code === 'STORE_NOT_FOUND' ? 404 :
          result.code === 'IDEMPOTENT_DUPLICATE' || result.code === 'IDEMPOTENCY_CONFLICT' ? 409 :
          result.code === 'INSUFFICIENT_BALANCE' || result.code === 'PROVIDER_REJECTED' ? 422 :
          result.code === 'CONFIG_ERROR' ? 503 :
          result.code === 'RECONCILIATION_REQUIRED' ? 202 :
          result.code === 'GATEWAY_ERROR' ? 502 : 400;

        return res.status(statusCode).json(result);
      }

      return res.json(result);
    } catch (err: any) {
      console.error(`[server-wallet] Erro não tratado (req: ${requestId}):`, err.message);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Ocorreu um erro interno ao processar a solicitação de saque.',
        requestId
      });
    }
  });

  /**
   * GET /api/finances/:storeId/withdrawals/:withdrawalId
   * Consulta os dados autorizados de um saque específico da loja com proteção de propriedade e máscara de dados.
   */
  app.get('/api/finances/:storeId/withdrawals/:withdrawalId', authMiddleware, async (req: express.Request, res: express.Response) => {
    const requestId = crypto.randomUUID();
    try {
      const { storeId, withdrawalId } = req.params;
      const uid = (req as any).user?.uid;

      if (!uid) {
        return res.status(401).json({
          success: false,
          code: 'AUTH_REQUIRED',
          message: 'Autenticação necessária para consultar a operação.',
          requestId
        });
      }

      const db = getDb();
      const storeDoc = await db.collection('stores').doc(storeId).get();

      if (!storeDoc.exists) {
        return res.status(404).json({
          success: false,
          code: 'STORE_NOT_FOUND',
          message: 'Loja não encontrada.',
          requestId
        });
      }

      if (storeDoc.data().ownerId !== uid) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Acesso negado. Apenas o proprietário pode visualizar os detalhes deste saque.',
          requestId
        });
      }

      const wDoc = await db.collection('stores').doc(storeId).collection('withdrawals').doc(withdrawalId).get();
      if (!wDoc.exists) {
        return res.status(404).json({
          success: false,
          code: 'NOT_FOUND',
          message: 'Solicitação de saque não encontrada.',
          requestId
        });
      }

      const data = wDoc.data();
      return res.json({
        success: true,
        withdrawal: {
          id: wDoc.id,
          storeId,
          amount: data.amount,
          amountCents: data.amountCents,
          fee: data.fee,
          feeCents: data.feeCents,
          totalDeducted: data.totalDeducted,
          totalDeductedCents: data.totalDeductedCents,
          status: data.status,
          pixKeyType: data.pixKeyType,
          pixKey: data.maskedPixKey || '***',
          gateway: data.gateway,
          providerStatus: data.providerStatus || null,
          failureReason: data.failureReason || null,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        },
        requestId
      });
    } catch (err: any) {
      console.error(`[server-wallet] Erro ao consultar saque (req: ${requestId}):`, err.message);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Erro interno ao consultar dados da operação.',
        requestId
      });
    }
  });
}
