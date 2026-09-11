import express from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

export function setupWalletRoutes(app: express.Express, authMiddleware: any, getDb: any) {
  app.post('/api/wallet/:storeId/withdraw', authMiddleware, async (req: express.Request, res: express.Response) => {
    try {
      const { storeId } = req.params;
      const { amount, pixKey, pixKeyType, idempotencyKey } = req.body;
      const uid = req.user?.uid;
      
      if (!uid) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Não autorizado.' });
      }

      const withdrawAmount = parseFloat(amount);
      if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        return res.status(400).json({ success: false, code: 'INVALID_AMOUNT', message: 'Valor de saque inválido.' });
      }

      const WITHDRAW_FEE = 10;
      const totalNeeded = withdrawAmount + WITHDRAW_FEE;
      const db = getDb();

      // Idempotency Key (usa a enviada pelo front ou gera uma hash baseada na requisição)
      const iKey = idempotencyKey || crypto.createHash('sha256').update(`${uid}-${storeId}-${amount}-${pixKey}-${Date.now()}`).digest('hex');

      const storeRef = db.collection('stores').doc(storeId);
      const withdrawalsRef = storeRef.collection('withdrawals');
      const ordersRef = storeRef.collection('orders');

      // 1. RESERVA ATÔMICA
      const reservationResult = await db.runTransaction(async (t: any) => {
        // Validação de segurança: apenas o dono pode sacar
        const storeDoc = await t.get(storeRef);
        if (!storeDoc.exists || storeDoc.data().ownerId !== uid) {
          throw new Error('FORBIDDEN');
        }

        // Validação de idempotência
        const existingWithdrawalQuery = await t.get(withdrawalsRef.where('idempotencyKey', '==', iKey).limit(1));
        if (!existingWithdrawalQuery.empty) {
          throw new Error('IDEMPOTENT_DUPLICATE');
        }

        // Calcular saldo disponível (somente pedidos com + de 3 dias)
        // OBS: Como não podemos passar de 500 reads dentro de uma transaction de forma otimizada para lojas imensas, 
        // isto resolve o cenário atual da arquitetura. Numa v2, manter balance agregado na storeDoc.
        const ordersQuery = await t.get(ordersRef.where('status', '==', 'paid'));
        let availableBalanceAcc = 0;
        const now = Date.now();
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

        ordersQuery.forEach((doc: any) => {
          const order = doc.data();
          const value = order.total || 0;
          const method = order.paymentMethod || 'pix';
          
          let fee = 0;
          if (method === 'credit_card' || method === 'debit_card') fee = value * 0.13;
          else if (method === 'boleto') fee = value * 0.09;
          else fee = value * 0.07;
          
          const netValue = value - fee;
          let paidAtTime = 0;
          
          if (order.paidAt) {
             paidAtTime = typeof order.paidAt.toDate === 'function' ? order.paidAt.toDate().getTime() : new Date(order.paidAt).getTime();
          } else if (order.createdAt) {
             paidAtTime = typeof order.createdAt.toDate === 'function' ? order.createdAt.toDate().getTime() : new Date(order.createdAt).getTime();
          } else {
             paidAtTime = now;
          }

          if ((now - paidAtTime) >= THREE_DAYS_MS) {
            availableBalanceAcc += netValue;
          }
        });

        // Calcular saques anteriores
        const withdrawalsQuery = await t.get(withdrawalsRef);
        let totalWithdrawn = 0;
        withdrawalsQuery.forEach((doc: any) => {
          const w = doc.data();
          // "processing" significa que o valor já está reservado por uma transação paralela
          if (w.status === 'pending' || w.status === 'processing' || w.status === 'completed') {
            totalWithdrawn += (w.amount || 0);
            totalWithdrawn += (w.fee || 10);
          }
        });

        const availableBalance = Math.max(availableBalanceAcc - totalWithdrawn, 0);

        if (totalNeeded > availableBalance) {
          throw new Error(`INSUFFICIENT_BALANCE|${availableBalance}`);
        }

        // Criar o documento de saque como 'processing' (Reserva de Valor)
        const newWithdrawalRef = withdrawalsRef.doc();
        const withdrawalData = {
          id: newWithdrawalRef.id,
          storeId,
          amount: withdrawAmount,
          fee: WITHDRAW_FEE,
          totalDeducted: totalNeeded,
          status: 'processing', // estado inicial reservado
          pixKey,
          pixKeyType,
          idempotencyKey: iKey,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };
        t.set(newWithdrawalRef, withdrawalData);

        return withdrawalData;
      });

      // 2. CHAMADA EXTERNA (MISTIC PAY) - SOMENTE AGORA!
      const MISTIC_API_URL = 'https://api.misticpay.com/api';
      const clientId = process.env.MISTIC_PAY_CLIENT_ID;
      const clientSecret = process.env.MISTIC_PAY_CLIENT_SECRET;
      
      let misticResponseParsed = null;
      let misticStatus = 500;

      if (clientId && clientSecret) {
        try {
          const base64Auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
          
          // Uso do fetch nativo (evitando node-fetch)
          const response = await fetch(`${MISTIC_API_URL}/transactions/withdraw`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${base64Auth}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              amount: withdrawAmount,
              pixKey,
              pixKeyType,
              transactionId: reservationResult.id
            })
          });

          misticStatus = response.status;
          const contentType = response.headers.get('content-type') || '';
          
          // Prevenção do erro "Unexpected token '<', <!doctype ... is not valid JSON"
          if (contentType.includes('application/json')) {
             misticResponseParsed = await response.json();
          } else {
             const textResp = await response.text();
             misticResponseParsed = { raw: textResp.substring(0, 500) }; // salva apenas um trecho seguro
          }
          
          if (!response.ok) {
            throw new Error(`MisticPay Error: HTTP ${response.status}`);
          }

          // 3A. SUCESSO - Confirmar saque
          await db.collection('stores').doc(storeId).collection('withdrawals').doc(reservationResult.id).update({
            status: 'completed',
            misticTransactionId: misticResponseParsed?.data?.transactionId || null,
            updatedAt: FieldValue.serverTimestamp()
          });

          return res.json({ success: true, message: 'Saque processado com sucesso.', withdrawalId: reservationResult.id });

        } catch (misticErr: any) {
          // Log sanitizado
          console.error('[MISTIC PAY WITHDRAW ERROR]', {
            status: misticStatus,
            message: misticErr.message,
            response: misticResponseParsed
          });

          // 3B. FALHA - Rollback da reserva e liberação do saldo
          await db.collection('stores').doc(storeId).collection('withdrawals').doc(reservationResult.id).update({
            status: 'failed',
            errorDetails: misticErr.message,
            updatedAt: FieldValue.serverTimestamp()
          });
          
          return res.status(500).json({ 
            success: false, 
            code: 'MISTIC_PAY_ERROR', 
            message: 'Erro ao processar saque com a provedora. O valor foi devolvido ao seu saldo disponível imediatamente.',
          });
        }
      } else {
         // Rollback caso credenciais não existam no ambiente de produção
         await db.collection('stores').doc(storeId).collection('withdrawals').doc(reservationResult.id).update({
            status: 'failed',
            errorDetails: 'MisticPay não configurado (Faltam credenciais)',
            updatedAt: FieldValue.serverTimestamp()
         });
         return res.status(500).json({ success: false, code: 'NOT_CONFIGURED', message: 'Gateway de pagamento não configurado.' });
      }

    } catch (err: any) {
      console.error('Erro geral ao processar saque:', err.message);
      
      if (err.message === 'FORBIDDEN') {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Acesso negado à carteira.' });
      }
      if (err.message === 'IDEMPOTENT_DUPLICATE') {
        return res.status(409).json({ success: false, code: 'DUPLICATE', message: 'Esta solicitação de saque já está sendo processada.' });
      }
      if (err.message.startsWith('INSUFFICIENT_BALANCE')) {
        const bal = err.message.split('|')[1];
        return res.status(400).json({ 
          success: false, 
          code: 'INSUFFICIENT_BALANCE', 
          message: `Saldo insuficiente para realizar o saque. Saldo disponível hoje: R$ ${parseFloat(bal).toFixed(2)}` 
        });
      }

      return res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' });
    }
  });
}
