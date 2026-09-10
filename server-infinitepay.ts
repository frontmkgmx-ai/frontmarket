import express from 'express';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export function setupInfinitePayRoutes(app: express.Express, authMiddleware: any, getDb: any) {
  
  app.get('/api/gateways/infinitepay/:storeId', authMiddleware, async (req, res) => {
    try {
      const { storeId } = req.params;
      const uid = (req as any).user.uid;
      const db = getDb();
      const storeDoc = await getDoc(doc(db, 'stores', storeId));
      if (!storeDoc.exists() || storeDoc.data()?.ownerId !== uid) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const querySnapshot = await getDocs(query(collection(db, 'seller_payment_gateways'), where('storeId', '==', storeId), where('gateway_type', '==', 'infinitepay')));

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
      console.error('API Error in ' + req.path + ':', error);
      if (error.code === 7 || error.message.includes('PERMISSION_DENIED')) {
          res.status(403).json({ error: 'Firebase Admin Permissions Error. Missing FIREBASE_SERVICE_ACCOUNT.' });
      } else {
          res.status(500).json({ error: 'Internal Server Error', details: error.message });
      }
    }
  });

  app.post('/api/gateways/infinitepay', authMiddleware, async (req, res) => {
    try {
      const { storeId, infiniteHandle, webhookUrl, status } = req.body;
      const uid = (req as any).user.uid;
      const db = getDb();
      const storeDoc = await getDoc(doc(db, 'stores', storeId));
      if (!storeDoc.exists() || storeDoc.data()?.ownerId !== uid) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const updateData: any = {
        storeId,
        gateway_name: 'InfinitePay',
        gateway_type: 'infinitepay',
        status: status === 'active' ? 'active' : 'inactive',
        updated_at: serverTimestamp()
      };

      if (infiniteHandle !== undefined) updateData.infinite_handle = infiniteHandle;
      if (webhookUrl !== undefined) updateData.webhook_url = webhookUrl;

      const querySnapshot = await getDocs(query(collection(db, 'seller_payment_gateways'), where('storeId', '==', storeId), where('gateway_type', '==', 'infinitepay')));

      if (querySnapshot.empty) {
          updateData.created_at = serverTimestamp();
          await addDoc(collection(db, 'seller_payment_gateways'), updateData);
      } else {
          await updateDoc(querySnapshot.docs[0].ref, updateData);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('API Error in ' + req.path + ':', error);
      if (error.code === 7 || error.message.includes('PERMISSION_DENIED')) {
          res.status(403).json({ error: 'Firebase Admin Permissions Error. Missing FIREBASE_SERVICE_ACCOUNT.' });
      } else {
          res.status(500).json({ error: 'Internal Server Error', details: error.message });
      }
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
