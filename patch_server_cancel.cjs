const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

const cancelEndpoint = `
  app.post('/api/checkout/misticpay/cancel', async (req, res) => {
    try {
      const { storeId, orderId } = req.body;
      if (!storeId || !orderId) return res.status(400).json({ error: 'Missing params' });
      
      const db = getDb();
      const orderRef = db.collection('stores').doc(storeId).collection('orders').doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) return res.status(404).json({ error: 'Not found' });
      
      const data = orderSnap.data();
      if (data.status === 'pending') {
        await orderRef.update({
          status: 'cancelled',
          updatedAt: new Date().toISOString()
        });
      }
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[MisticPay] Cancel error:', err);
      return res.status(500).json({ error: err.message });
    }
  });
`;

code = code.replace(
  "  app.post('/api/checkout/misticpay/status', async (req, res) => {",
  cancelEndpoint + "\n  app.post('/api/checkout/misticpay/status', async (req, res) => {"
);

fs.writeFileSync('server-misticpay.ts', code);
