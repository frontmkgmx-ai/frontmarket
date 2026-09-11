const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

const statusRoute = `
  /**
   * Consulta ativa de status da transação na Mistic Pay
   */
  app.post('/api/checkout/misticpay/status', express.json(), async (req, res) => {
    try {
      const { storeId, orderId } = req.body;
      if (!storeId || !orderId) {
        return res.status(400).json({ error: 'storeId e orderId são obrigatórios' });
      }

      const db = getDb();
      const orderRef = db.collection('stores').doc(storeId).collection('orders').doc(orderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }

      const orderData = orderDoc.data();
      if (orderData.status === 'paid' || orderData.status === 'processing' || orderData.status === 'shipped' || orderData.status === 'delivered') {
        return res.json({ status: orderData.status });
      }

      const misticTxId = orderData.misticTransactionId;
      if (!misticTxId) {
        return res.status(400).json({ error: 'Pedido não possui transação MisticPay vinculada' });
      }

      const check = await checkTransactionWithMistic(String(misticTxId));
      if (check.state === 'COMPLETO' || check.status === 'SUCCESS') {
        // Atualiza a máquina de estados para aprovar a compra
        const FinancialWalletService = require('./server-financial-service').FinancialWalletService;
        
        await db.runTransaction(async (t: any) => {
          const freshOrder = await t.get(orderRef);
          const freshData = freshOrder.data();
          if (freshData.status !== 'pending' && freshData.status !== 'pending_verification') {
            return;
          }
          t.update(orderRef, {
            status: 'paid',
            updatedAt: new Date()
          });
        });

        // Liberação dos valores na carteira
        try {
          await FinancialWalletService.creditPayment(db, {
            storeId: storeId,
            orderId: orderId,
            totalValue: orderData.total,
            platformFeeRate: 0.05 // Ou buscar a taxa padrão
          });
        } catch (walletErr) {
          console.error('[MisticPay Sync] Erro ao atualizar carteira do logista:', walletErr);
        }

        return res.json({ status: 'paid' });
      }

      return res.json({ status: orderData.status, gatewayState: check.state });
    } catch (err: any) {
      console.error('[MisticPay Sync] Falha:', err);
      return res.status(500).json({ error: err.message });
    }
  });
`;

code = code.replace('  /**\n   * Webhook Financeiro Seguro MisticPay', statusRoute + '\n  /**\n   * Webhook Financeiro Seguro MisticPay');
fs.writeFileSync('server-misticpay.ts', code);
