import express from 'express';
import crypto from 'crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fetch from 'node-fetch'; // Vite's node environment usually has global fetch

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)) : crypto.scryptSync('fallback-secret-invictuspay-key', 'salt', 32);

export function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(text: string) {
  const [ivHex, authTagHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
}

export function setupInvictusPayRoutes(app: express.Express, authMiddleware: any, getDb: any) {
  

  // Get config
  app.get('/api/gateways/invictuspay/:storeId', authMiddleware, async (req, res) => {
    try {
      const { storeId } = req.params;
      const uid = (req as any).user.uid;
      
      const db = getDb();
      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.data();
      
      if (!userData?.stores?.includes(storeId)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const querySnapshot = await db.collection('seller_payment_gateways')
          .where('storeId', '==', storeId)
          .where('gateway_type', '==', 'invictuspay')
          .get();

      if (querySnapshot.empty) {
          return res.json({ status: 'inactive', hasKey: false });
      }

      const data = querySnapshot.docs[0].data();
      let maskedKey = '';
      if (data.api_key_encrypted) {
          try {
              const rawKey = decrypt(data.api_key_encrypted);
              maskedKey = `sk_****${rawKey.slice(-4)}`;
          } catch(e) {
              console.error('Decryption error:', e);
          }
      }

      res.json({ 
          status: data.status,
          hasKey: !!data.api_key_encrypted,
          maskedKey
      });
    } catch (error: any) {
      console.error('Error fetching invictuspay config:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Save config
  app.post('/api/gateways/invictuspay', authMiddleware, async (req, res) => {
    try {
      const { storeId, apiKey, status } = req.body;
      const uid = (req as any).user.uid;
      
      const db = getDb();
      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.data();
      
      if (!userData?.stores?.includes(storeId)) {
         return res.status(403).json({ error: 'Forbidden' });
      }

      let encryptedKey = undefined;
      if (apiKey && apiKey.startsWith('sk_')) {
          encryptedKey = encrypt(apiKey);
      } else if (apiKey === '') {
          encryptedKey = null;
      }

      const updateData: any = {
        storeId,
        gateway_name: 'InvictusPay',
        gateway_type: 'invictuspay',
        status: status === 'active' ? 'active' : 'inactive',
        updated_at: FieldValue.serverTimestamp()
      };

      if (encryptedKey !== undefined) {
         updateData.api_key_encrypted = encryptedKey;
      }

      const querySnapshot = await db.collection('seller_payment_gateways')
          .where('storeId', '==', storeId)
          .where('gateway_type', '==', 'invictuspay')
          .get();

      if (querySnapshot.empty) {
          updateData.created_at = FieldValue.serverTimestamp();
          await db.collection('seller_payment_gateways').add(updateData);
      } else {
          await querySnapshot.docs[0].ref.update(updateData);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error saving invictuspay config:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Test connection
  app.post('/api/gateways/invictuspay/test', authMiddleware, async (req, res) => {
    try {
        const { storeId, apiKey } = req.body;
        const uid = (req as any).user.uid;
        
        const db = getDb();
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.data()?.stores?.includes(storeId)) {
             return res.status(403).json({ error: 'Forbidden' });
        }

        let keyToUse = apiKey;
        if (!keyToUse || !keyToUse.startsWith('sk_')) {
            const querySnapshot = await db.collection('seller_payment_gateways')
                .where('storeId', '==', storeId)
                .where('gateway_type', '==', 'invictuspay')
                .get();

            if (querySnapshot.empty || !querySnapshot.docs[0].data().api_key_encrypted) {
                return res.status(400).json({ error: 'No API key provided or saved.' });
            }
            keyToUse = decrypt(querySnapshot.docs[0].data().api_key_encrypted);
        }

        const _fetch = globalThis.fetch || require('node-fetch');
        const response = await _fetch('https://api.invictuspayv2.com.br/api/v1/account', {
            headers: { 'X-Api-Key': keyToUse }
        });

        if (response.ok) {
            const data = await response.json();
            return res.json({ success: true, account: data });
        } else {
            return res.status(400).json({ error: 'Chave inválida ou erro na conexão.' });
        }
    } catch (error: any) {
        console.error('Test connection error:', error);
        res.status(500).json({ error: 'Erro de comunicação.' });
    }
  });
  
  // Checkout endpoint (Public, no authMiddleware needed, but should probably be protected against spam)
  app.post('/api/checkout/invictuspay', async (req, res) => {
      try {
          const { storeId, customerId, customerUsername, items, subtotal, total, customer, shippingAddress } = req.body;
          
          if (!storeId || !total) {
              return res.status(400).json({ error: 'Missing required fields' });
          }

          const db = getDb();
          const querySnapshot = await db.collection('seller_payment_gateways')
                .where('storeId', '==', storeId)
                .where('gateway_type', '==', 'invictuspay')
                .where('status', '==', 'active')
                .get();

          if (querySnapshot.empty || !querySnapshot.docs[0].data().api_key_encrypted) {
                return res.status(400).json({ error: 'InvictusPay is not active for this store.' });
          }
          
          const keyToUse = decrypt(querySnapshot.docs[0].data().api_key_encrypted);
          
          const payload = {
             amount: Math.round(total * 100),
             paymentMethod: "pix",
             customer: {
                name: customer.name,
                email: customer.email,
                document: customer.document,
                phone: customer.phone
             },
             items: items.map((i: any) => ({
                offer_hash: i.productId, // Simplification, mapping productId to offer_hash
                quantity: i.quantity,
                amount: Math.round(i.price * 100)
             })),
             pix: {
                expirationInSeconds: 1800
             }
          };

          const _fetch = globalThis.fetch || require('node-fetch');
          const response = await _fetch('https://api.invictuspayv2.com.br/api/v1/transactions', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'X-Api-Key': keyToUse
              },
              body: JSON.stringify(payload)
          });
          
          if (!response.ok) {
              const errTxt = await response.text();
              console.error('InvictusPay Checkout Error:', errTxt);
              return res.status(400).json({ error: 'Error generating PIX charge.' });
          }

          const txData = await response.json();
          // Assuming txData contains transaction id and pix qrcode/copy paste data
          
          // Save order to Firestore
          const orderData = {
              storeId,
              customerId,
              customerUsername,
              items,
              subtotal,
              shipping: 0,
              discount: 0,
              total,
              status: 'pending',
              customer,
              shippingAddress,
              paymentMethod: 'pix',
              gateway: 'invictuspay',
              transaction_id: txData.id || txData.transaction_id || txData.txid, // Depends on exact response
              payment_status: 'pending',
              createdAt: FieldValue.serverTimestamp()
          };

          const orderRef = await db.collection('stores').doc(storeId).collection('orders').add(orderData);
          
          // Update customer metrics
          try {
             await db.collection('stores').doc(storeId).collection('customers').doc(customerId).update({
                totalOrders: FieldValue.increment(1),
                totalSpent: FieldValue.increment(total),
                lastOrderAt: FieldValue.serverTimestamp()
             });
          } catch(e) {}

          res.json({ 
              success: true, 
              orderId: orderRef.id,
              pix: txData.pix || txData // Return PIX data for frontend
          });

      } catch(error) {
          console.error('Checkout error:', error);
          res.status(500).json({ error: 'Internal server error' });
      }
  });

  // Webhook Receiver
  app.post('/api/webhook/invictuspay', async (req, res) => {
      try {
          const payload = req.body;
          const event = payload.event;
          const txId = payload.transaction?.id;

          if (!txId) {
             return res.status(400).json({ error: 'Missing transaction id' });
          }

          const db = getDb();
          
          // We need to find the order with this transaction_id
          // This requires a collectionGroup query since orders are nested under stores/{storeId}/orders
          const ordersSnap = await db.collectionGroup('orders')
              .where('transaction_id', '==', txId)
              .where('gateway', '==', 'invictuspay')
              .get();

          if (ordersSnap.empty) {
             console.warn('Webhook received but no order found for txId:', txId);
             return res.status(200).send('OK'); // Return 200 so InvictusPay stops retrying
          }

          for (const docSnap of ordersSnap.docs) {
              const orderRef = docSnap.ref;
              
              if (event === 'EVENT:CHARGE_PAID') {
                  await orderRef.update({
                      status: 'paid',
                      payment_status: 'paid',
                      updatedAt: FieldValue.serverTimestamp()
                  });
              } else if (event === 'EVENT:CHARGE_EXPIRED' || event === 'EVENT:CHARGE_REFUND' || event === 'EVENT:CHARGE_CHARGEBACK' || event === 'EVENT:CHARGE_CANCELLED') {
                  await orderRef.update({
                      status: 'cancelled',
                      payment_status: 'failed',
                      updatedAt: FieldValue.serverTimestamp()
                  });
              }
          }

          res.status(200).send('OK');
      } catch(err) {
          console.error('Webhook processing error:', err);
          res.status(500).json({ error: 'Internal Error' });
      }
  });


  // Cashout endpoint
  app.post('/api/gateways/invictuspay/:storeId/cashout', authMiddleware, async (req, res) => {
     try {
        const storeId = req.params.storeId;
        const { amount, key_type, key_value } = req.body;
        const uid = (req).user.uid;
        
        const db = getDb();
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.data()?.stores?.includes(storeId)) {
             return res.status(403).json({ error: 'Forbidden' });
        }
        
        const querySnapshot = await db.collection('seller_payment_gateways')
            .where('storeId', '==', storeId)
            .where('gateway_type', '==', 'invictuspay')
            .get();

        if (querySnapshot.empty || !querySnapshot.docs[0].data().api_key_encrypted) {
            return res.status(400).json({ error: 'Gateway não configurado' });
        }
        
        const keyToUse = decrypt(querySnapshot.docs[0].data().api_key_encrypted);
        
        const _fetch = globalThis.fetch || require('node-fetch');
        const response = await _fetch('https://api.invictuspayv2.com.br/api/v1/cashout', {
            method: 'POST',
            headers: { 
               'Content-Type': 'application/json',
               'X-Api-Key': keyToUse 
            },
            body: JSON.stringify({ amount, key_type, key_value })
        });
        
        if (response.ok) {
            const data = await response.json();
            return res.json({ success: true, cashout: data });
        } else {
            const errData = await response.text();
            return res.status(400).json({ error: 'Erro ao solicitar saque.', details: errData });
        }
     } catch(err) {
        res.status(500).json({ error: 'Internal Server Error' });
     }
  });
}
