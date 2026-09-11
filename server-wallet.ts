import express from 'express';
import { restRunQuery, restAddDoc, restGetDocs, restDeleteDoc } from './firestore-rest.js';

export function setupWalletRoutes(app: express.Express, authMiddleware: any, getDb: any) {
  app.post('/api/wallet/:storeId/withdraw', authMiddleware, async (req: express.Request, res: express.Response) => {
    try {
      const { storeId } = req.params;
      const { amount, pixKey, pixKeyType } = req.body;
      const uid = (req as any).user?.uid;
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!uid || !token) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }

      const withdrawAmount = parseFloat(amount);
      if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        return res.status(400).json({ error: 'Valor de saque inválido.' });
      }

      const WITHDRAW_FEE = 10;
      const totalNeeded = withdrawAmount + WITHDRAW_FEE;
      const parentPath = `stores/${storeId}`;

      // Calcular saldo disponível (somente pedidos com + de 3 dias)
      const orders = await restRunQuery(parentPath, 'orders', [
        {
          fieldFilter: {
            field: { fieldPath: 'status' },
            op: 'EQUAL',
            value: { stringValue: 'paid' }
          }
        }
      ], token);
      
      let availableBalanceAcc = 0;
      const now = Date.now();
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

      orders.forEach((order: any) => {
        const value = order.total || 0;
        const method = order.paymentMethod || 'pix';
        
        let fee = 0;
        if (method === 'credit_card' || method === 'debit_card') {
          fee = value * 0.13;
        } else if (method === 'boleto') {
          fee = value * 0.09;
        } else {
          fee = value * 0.07;
        }
        
        const netValue = value - fee;
        let paidAtTime = 0;
        
        if (order.paidAt) paidAtTime = new Date(order.paidAt).getTime();
        else if (order.createdAt) paidAtTime = new Date(order.createdAt).getTime();
        else paidAtTime = now;

        const isReleased = (now - paidAtTime) >= THREE_DAYS_MS;
        if (isReleased) {
          availableBalanceAcc += netValue;
        }
      });

      // Obter saques
      let withdrawals = await restGetDocs(`stores/${storeId}/withdrawals`, token);
      let needsRefetch = false;

      // Limpeza de saques antigos presos
      for (const w of withdrawals) {
        if (w.status === 'pending') {
          const createdAt = w.createdAt ? new Date(w.createdAt).getTime() : 0;
          if (createdAt < new Date('2026-09-11T00:00:00Z').getTime()) {
            await restDeleteDoc(`stores/${storeId}/withdrawals/${w.id}`, token);
            needsRefetch = true;
          }
        }
      }
      
      if (needsRefetch) {
         withdrawals = await restGetDocs(`stores/${storeId}/withdrawals`, token);
      }
      
      let totalWithdrawn = 0;
      withdrawals.forEach((w: any) => {
        if (w.status === 'pending' || w.status === 'completed') {
          totalWithdrawn += (w.amount || 0);
          totalWithdrawn += (w.fee || 10);
        }
      });

      const availableBalance = Math.max(availableBalanceAcc - totalWithdrawn, 0);

      if (totalNeeded > availableBalance) {
        return res.status(400).json({ 
          error: `Saldo insuficiente. Lembre-se que o valor das vendas só é liberado para saque 3 dias após o pagamento. Saldo liberado atual: R$ ${availableBalance.toFixed(2)}. Você solicitou R$ ${withdrawAmount.toFixed(2)} + R$ 10,00 de taxa (Total R$ ${totalNeeded.toFixed(2)}).` 
        });
      }

      // Criar a solicitação de saque no Firebase via REST
      await restAddDoc(`stores/${storeId}`, 'withdrawals', {
        storeId,
        amount: withdrawAmount,
        fee: WITHDRAW_FEE,
        totalDeducted: totalNeeded,
        status: 'pending',
        pixKey,
        pixKeyType,
        createdAt: new Date()
      }, token);

      res.json({ success: true, message: 'Saque solicitado com sucesso.' });
    } catch (err: any) {
      console.error('Erro ao processar saque:', err);
      // Cleanest error response without crashing
      res.status(500).json({ error: err.message || 'Erro interno do servidor ao solicitar saque.' });
    }
  });
}
