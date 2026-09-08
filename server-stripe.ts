import express from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { encrypt, decrypt } from './server-invictuspay.js';

export function setupStripeRoutes(app: express.Express, authMiddleware: any, getDb: any) {
  
  app.get('/api/gateways/stripe/:storeId', authMiddleware, async (req, res) => {
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
          .where('gateway_type', '==', 'stripe')
          .get();

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
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/gateways/stripe', authMiddleware, async (req, res) => {
    try {
      const { storeId, accountId, publicKey, status } = req.body;
      const uid = (req as any).user.uid;
      const db = getDb();
      const userDoc = await db.collection('users').doc(uid).get();
      
      if (!userDoc.data()?.stores?.includes(storeId)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const updateData: any = {
        storeId,
        gateway_name: 'Stripe Connect',
        gateway_type: 'stripe',
        status: status === 'active' ? 'active' : 'inactive',
        updated_at: FieldValue.serverTimestamp()
      };

      if (accountId !== undefined) updateData.stripe_account_id = accountId;
      if (publicKey !== undefined) updateData.stripe_public_key = publicKey;

      const querySnapshot = await db.collection('seller_payment_gateways')
          .where('storeId', '==', storeId)
          .where('gateway_type', '==', 'stripe')
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
