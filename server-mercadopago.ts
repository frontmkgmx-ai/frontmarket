import express from 'express';
import crypto from 'crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fetch from 'node-fetch';
import { encrypt, decrypt } from './server-invictuspay.js'; // reuse encrypt/decrypt

export function setupMercadoPagoRoutes(app: express.Express, authMiddleware: any, getDb: any) {
  
  // Get config
  app.get('/api/gateways/mercadopago/:storeId', authMiddleware, async (req, res) => {
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
          .where('gateway_type', '==', 'mercadopago')
          .get();

      if (querySnapshot.empty) {
          return res.json({ status: 'inactive', hasKey: false });
      }

      const data = querySnapshot.docs[0].data();
      let maskedKey = '';
      if (data.access_token_encrypted) {
          try {
              const rawKey = decrypt(data.access_token_encrypted);
              maskedKey = `APP_USR-****${rawKey.slice(-4)}`;
          } catch(e) {}
      }

      res.json({ 
          status: data.status,
          hasKey: !!data.access_token_encrypted,
          maskedKey,
          publicKey: data.public_key || ''
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Save config
  app.post('/api/gateways/mercadopago', authMiddleware, async (req, res) => {
    try {
      const { storeId, accessToken, publicKey, status } = req.body;
      const uid = (req as any).user.uid;
      const db = getDb();
      const userDoc = await db.collection('users').doc(uid).get();
      
      if (!userDoc.data()?.stores?.includes(storeId)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      let encryptedKey = undefined;
      if (accessToken && accessToken.startsWith('APP_USR-')) {
          encryptedKey = encrypt(accessToken);
      } else if (accessToken === '') {
          encryptedKey = null;
      }

      const updateData: any = {
        storeId,
        gateway_name: 'Mercado Pago',
        gateway_type: 'mercadopago',
        status: status === 'active' ? 'active' : 'inactive',
        updated_at: FieldValue.serverTimestamp()
      };

      if (publicKey !== undefined) {
         updateData.public_key = publicKey;
      }

      if (encryptedKey !== undefined) {
         updateData.access_token_encrypted = encryptedKey;
      }

      const querySnapshot = await db.collection('seller_payment_gateways')
          .where('storeId', '==', storeId)
          .where('gateway_type', '==', 'mercadopago')
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

  // Test connection
  app.post('/api/gateways/mercadopago/test', authMiddleware, async (req, res) => {
    try {
        const { storeId, accessToken } = req.body;
        const uid = (req as any).user.uid;
        const db = getDb();
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.data()?.stores?.includes(storeId)) {
             return res.status(403).json({ error: 'Forbidden' });
        }

        let keyToUse = accessToken;
        if (!keyToUse || !keyToUse.startsWith('APP_USR-')) {
            const querySnapshot = await db.collection('seller_payment_gateways')
                .where('storeId', '==', storeId)
                .where('gateway_type', '==', 'mercadopago')
                .get();

            if (querySnapshot.empty || !querySnapshot.docs[0].data().access_token_encrypted) {
                return res.status(400).json({ error: 'No API key provided or saved.' });
            }
            keyToUse = decrypt(querySnapshot.docs[0].data().access_token_encrypted);
        }

        const _fetch = globalThis.fetch || require('node-fetch');
        const response = await _fetch('https://api.mercadopago.com/users/me', {
            headers: { 'Authorization': `Bearer ${keyToUse}` }
        });

        if (response.ok) {
            return res.json({ success: true });
        } else {
            return res.status(400).json({ error: 'Chave inválida ou erro na conexão.' });
        }
    } catch (error: any) {
        res.status(500).json({ error: 'Erro de comunicação.' });
    }
  });

  // Checkout (exemplo simplificado)
  app.post('/api/checkout/mercadopago', async (req, res) => {
      // Implement MP preference creation
      res.status(501).json({ error: 'Not implemented yet' });
  });

  app.post('/api/webhook/mercadopago', async (req, res) => {
      // Implement MP webhook
      res.status(200).send('OK');
  });

}
