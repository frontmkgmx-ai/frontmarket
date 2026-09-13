const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldEndpoint = `  app.post('/api/orders/:storeId/:orderId/trigger-email', async (req, res) => {
    try {
      const { storeId, orderId } = req.params;
      const { status } = req.body;
      const { triggerOrderStatusEmail } = await import('./server-email-triggers.js');
      await triggerOrderStatusEmail(storeId, orderId, status);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao disparar email' });
    }
  });`;

const newEndpoint = `  app.post('/api/orders/:storeId/:orderId/trigger-email', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado. Token ausente.' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      const { getFirebaseAdmin, getAdminDb } = await import('./server-firebase-admin.js');
      const admin = getFirebaseAdmin();
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      const { storeId, orderId } = req.params;
      
      // Verify store access
      const db = getAdminDb();
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();
      
      const userStores = userData?.stores || [];
      if (!userStores.includes(storeId)) {
         return res.status(403).json({ error: 'Acesso negado à loja.' });
      }

      const { status } = req.body;
      const { triggerOrderStatusEmail } = await import('./server-email-triggers.js');
      await triggerOrderStatusEmail(storeId, orderId, status);
      res.json({ success: true });
    } catch (err) {
      console.error('[Trigger Email] Erro:', err);
      res.status(500).json({ error: 'Erro ao disparar email' });
    }
  });`;

code = code.replace(oldEndpoint, newEndpoint);

fs.writeFileSync('server.ts', code);
