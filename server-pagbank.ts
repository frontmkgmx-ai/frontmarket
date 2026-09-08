import express from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { encrypt, decrypt } from './server-invictuspay.js';

export function setupPagBankRoutes(app: express.Express, authMiddleware: any, getDb: any) {
  
  app.get('/api/gateways/pagbank/:storeId', authMiddleware, async (req, res) => {
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
          .where('gateway_type', '==', 'pagbank')
          .get();

      if (querySnapshot.empty) {
          return res.json({ status: 'inactive', hasToken: false });
      }

      const data = querySnapshot.docs[0].data();
      let maskedToken = '';
      if (data.access_token_encrypted) {
          try {
              const rawKey = decrypt(data.access_token_encrypted);
              maskedToken = `****${rawKey.slice(-4)}`;
          } catch(e) {}
      }

      res.json({ 
          status: data.status,
          hasToken: !!data.access_token_encrypted,
          maskedToken,
          accountId: data.pagbank_account_id || ''
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/gateways/pagbank', authMiddleware, async (req, res) => {
    try {
      const { storeId, accessToken, accountId, status } = req.body;
      const uid = (req as any).user.uid;
      const db = getDb();
      const userDoc = await db.collection('users').doc(uid).get();
      
      if (!userDoc.data()?.stores?.includes(storeId)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      let encryptedKey = undefined;
      if (accessToken && accessToken.length > 5) {
          encryptedKey = encrypt(accessToken);
      } else if (accessToken === '') {
          encryptedKey = null;
      }

      const updateData: any = {
        storeId,
        gateway_name: 'PagBank',
        gateway_type: 'pagbank',
        status: status === 'active' ? 'active' : 'inactive',
        updated_at: FieldValue.serverTimestamp()
      };

      if (accountId !== undefined) updateData.pagbank_account_id = accountId;
      if (encryptedKey !== undefined) updateData.access_token_encrypted = encryptedKey;

      const querySnapshot = await db.collection('seller_payment_gateways')
          .where('storeId', '==', storeId)
          .where('gateway_type', '==', 'pagbank')
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

  app.post('/api/gateways/pagbank/test', authMiddleware, async (req, res) => {
      res.json({ success: true });
  });

  app.post('/api/checkout/pagbank', async (req, res) => {
      res.status(501).json({ error: 'Not implemented yet' });
  });

  app.post('/api/webhook/pagbank', async (req, res) => {
      res.status(200).send('OK');
  });
}
