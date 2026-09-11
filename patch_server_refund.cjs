const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

const refundEndpoint = `
  app.post('/api/checkout/misticpay/refund', async (req, res) => {
    try {
      const { storeId, orderId } = req.body;
      if (!storeId || !orderId) return res.status(400).json({ error: 'Missing params' });
      
      const db = getDb();
      const orderRef = db.collection('stores').doc(storeId).collection('orders').doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) return res.status(404).json({ error: 'Not found' });
      
      const data = orderSnap.data();
      if (data.status !== 'paid') {
        return res.status(400).json({ error: 'Only paid orders can be refunded' });
      }
      
      // Simulate refund logic by deducting from wallet
      await FinancialWalletService.debitWallet(db, {
        storeId,
        amountCents: Math.round(data.total * 100),
        reason: \`Refund for order \${orderId}\`,
        type: 'refund'
      });
      
      await orderRef.update({
        status: 'refunded',
        updatedAt: new Date().toISOString()
      });
      
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[MisticPay] Refund error:', err);
      return res.status(500).json({ error: err.message });
    }
  });
`;

code = code.replace(
  "  app.post('/api/checkout/misticpay/cancel', async (req, res) => {",
  refundEndpoint + "\n  app.post('/api/checkout/misticpay/cancel', async (req, res) => {"
);

fs.writeFileSync('server-misticpay.ts', code);
