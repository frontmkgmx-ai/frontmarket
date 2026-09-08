import express from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export function setupInfinitePayRoutes(app: express.Express, authMiddleware: any, getDb: any) {
  
  app.get('/api/gateways/infinitepay/:storeId', authMiddleware, async (req, res) => {
    try {
      const { storeId } = req.params;
      const uid = (req as any).user.uid;
      const db = getDb();
      const userDoc = await db.collection('users').doc(uid).get();
      
      if (!userDoc.data()?.stores?.includes(storeId)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const querySnapshot = await db.collection('seller_payment_gateways')
          .where('storeId', '==', storeId)
          .where('gateway_type', '==', 'infinitepay')
          .get();

      if (querySnapshot.empty) {
          return res.json({ status: 'inactive', infiniteHandle: '' });
      }

      const data = querySnapshot.docs[0].data();
      res.json({ 
          status: data.status,
          infiniteHandle: data.infinite_handle || '',
          webhookUrl: data.webhook_url || ''
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/gateways/infinitepay', authMiddleware, async (req, res) => {
    try {
      const { storeId, infiniteHandle, webhookUrl, status } = req.body;
      const uid = (req as any).user.uid;
      const db = getDb();
      const userDoc = await db.collection('users').doc(uid).get();
      
      if (!userDoc.data()?.stores?.includes(storeId)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const updateData: any = {
        storeId,
        gateway_name: 'InfinitePay',
        gateway_type: 'infinitepay',
        status: status === 'active' ? 'active' : 'inactive',
        updated_at: FieldValue.serverTimestamp()
      };

      if (infiniteHandle !== undefined) updateData.infinite_handle = infiniteHandle;
      if (webhookUrl !== undefined) updateData.webhook_url = webhookUrl;

      const querySnapshot = await db.collection('seller_payment_gateways')
          .where('storeId', '==', storeId)
          .where('gateway_type', '==', 'infinitepay')
          .get();

      if (querySnapshot.empty) {
          updateData.created_at = FieldValue.serverTimestamp();
          await db.collection('seller_payment_gateways').add(updateData);
      } else {
          await querySnapshot.docs[0].ref.update(updateData);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/gateways/infinitepay/test', authMiddleware, async (req, res) => {
      res.json({ success: true });
  });

  app.post('/api/checkout/infinitepay', async (req, res) => {
      res.status(501).json({ error: 'Not implemented yet' });
  });

  app.post('/api/webhook/infinitepay', async (req, res) => {
      res.status(200).send('OK');
  });
}
