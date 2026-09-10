import express from 'express';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { encrypt, decrypt } from './server-invictuspay.js';

export function setupStripeRoutes(app: express.Express, authMiddleware: any, getDb: any) {
  
  app.get('/api/gateways/stripe/:storeId', authMiddleware, async (req, res) => {
    try {
      const { storeId } = req.params;
      const uid = (req as any).user.uid;
      const db = getDb();
      const storeDoc = await getDoc(doc(db, 'stores', storeId));
      if (!storeDoc.exists() || storeDoc.data()?.ownerId !== uid) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const querySnapshot = await getDocs(query(collection(db, 'seller_payment_gateways'), where('storeId', '==', storeId), where('gateway_type', '==', 'stripe')));

      if (querySnapshot.empty) {
          return res.json({ status: 'inactive', hasAccountId: false });
      }

      const data = querySnapshot.docs[0].data();
      res.json({ 
          status: data.status,
          hasAccountId: !!data.stripe_account_id,
          accountId: data.stripe_account_id || '',
          publicKey: data.stripe_public_key || ''
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

  app.post('/api/gateways/stripe', authMiddleware, async (req, res) => {
    try {
      const { storeId, accountId, publicKey, status } = req.body;
      const uid = (req as any).user.uid;
      const db = getDb();
      const storeDoc = await getDoc(doc(db, 'stores', storeId));
      if (!storeDoc.exists() || storeDoc.data()?.ownerId !== uid) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const updateData: any = {
        storeId,
        gateway_name: 'Stripe Connect',
        gateway_type: 'stripe',
        status: status === 'active' ? 'active' : 'inactive',
        updated_at: serverTimestamp()
      };

      if (accountId !== undefined) updateData.stripe_account_id = accountId;
      if (publicKey !== undefined) updateData.stripe_public_key = publicKey;

      const querySnapshot = await getDocs(query(collection(db, 'seller_payment_gateways'), where('storeId', '==', storeId), where('gateway_type', '==', 'stripe')));

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

  app.post('/api/gateways/stripe/test', authMiddleware, async (req, res) => {
      // Assuming testing just checks if we have an accountId
      res.json({ success: true });
  });

  app.post('/api/checkout/stripe', async (req, res) => {
      res.status(501).json({ error: 'Not implemented yet' });
  });

  app.post('/api/webhook/stripe', async (req, res) => {
      res.status(200).send('OK');
  });
}
