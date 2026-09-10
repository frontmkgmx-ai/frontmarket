import express from 'express';
import { restRunQuery, restAddDoc, restGetDocs } from './firestore-rest.js';

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

      const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0736685342';
      const DATABASE_ID = process.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901';
      const parentPath = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/stores/${storeId}`;

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

      // Subtrair saques já realizados ou pendentes
      const withdrawals = await restGetDocs(`projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/stores/${storeId}/withdrawals`, token);
      
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
          error: `Saldo insuficiente para este saque. Você tem R$ ${availableBalance.toFixed(2)} disponível, mas solicitou R$ ${withdrawAmount.toFixed(2)} + R$ 10,00 de taxa (Total R$ ${totalNeeded.toFixed(2)}).` 
        });
      }

      // Se passou na checagem, cria a solicitação de saque no Firebase usando REST API e o token do usuário!
      await restAddDoc(`projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/stores/${storeId}`, 'withdrawals', {
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
      res.status(500).json({ error: err.message || 'Erro interno do servidor ao solicitar saque.' });
    }
  });
}
