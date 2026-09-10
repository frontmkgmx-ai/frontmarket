import express from 'express';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { encrypt, decrypt } from './server-invictuspay.js';

export function setupPagBankRoutes(app: express.Express, authMiddleware: any, getDb: any) {
  
  app.get('/api/gateways/pagbank/:storeId', authMiddleware, async (req, res) => {
    try {
      const { storeId } = req.params;
      const uid = (req as any).user.uid;
      const db = getDb();
      const storeDoc = await getDoc(doc(db, 'stores', storeId));
      if (!storeDoc.exists() || storeDoc.data()?.ownerId !== uid) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const querySnapshot = await getDocs(query(collection(db, 'seller_payment_gateways'), where('storeId', '==', storeId), where('gateway_type', '==', 'pagbank')));

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
      console.error('API Error in ' + req.path + ':', error);
      if (error.code === 7 || error.message.includes('PERMISSION_DENIED')) {
          res.status(403).json({ error: 'Firebase Admin Permissions Error. Missing FIREBASE_SERVICE_ACCOUNT.' });
      } else {
          res.status(500).json({ error: 'Internal Server Error', details: error.message });
      }
    }
  });

  app.post('/api/gateways/pagbank', authMiddleware, async (req, res) => {
    try {
      const { storeId, accessToken, accountId, status } = req.body;
      const uid = (req as any).user.uid;
      const db = getDb();
      const storeDoc = await getDoc(doc(db, 'stores', storeId));
      if (!storeDoc.exists() || storeDoc.data()?.ownerId !== uid) {
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
        updated_at: serverTimestamp()
      };

      if (accountId !== undefined) updateData.pagbank_account_id = accountId;
      if (encryptedKey !== undefined) updateData.access_token_encrypted = encryptedKey;

      const querySnapshot = await getDocs(query(collection(db, 'seller_payment_gateways'), where('storeId', '==', storeId), where('gateway_type', '==', 'pagbank')));

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
