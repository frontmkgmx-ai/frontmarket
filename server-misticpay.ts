import express from 'express';

import { FieldValue } from 'firebase-admin/firestore';

export function setupMisticPayRoutes(app: express.Express, authMiddleware: any, getDb: any) {
  const MISTIC_API_URL = 'https://api.misticpay.com/api';

  // Helper para header de auth
  const getMisticAuthHeader = () => {
    const clientId = process.env.MISTIC_PAY_CLIENT_ID;
    const clientSecret = process.env.MISTIC_PAY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('As chaves do Mistic Pay não estão configuradas (MISTIC_PAY_CLIENT_ID e MISTIC_PAY_CLIENT_SECRET).');
    }

    const base64Auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    return `Basic ${base64Auth}`;
  };

  // Endpoint para Checkout - Gera QR Code PIX via MisticPay
  app.post('/api/checkout/misticpay', async (req, res) => {
    try {
      const { storeId, customerId, customerUsername, items, subtotal, total, customer, shippingAddress } = req.body;
      const db = getDb();

      // Create Order first to get an ID
      const orderRef = db.collection('stores').doc(storeId).collection('orders').doc();
      const orderId = orderRef.id;

      // Chama a API da Mistic Pay
      const payload = {
        amount: total,
        payerName: customer.name || 'Cliente da Loja',
        payerDocument: (customer.document || '00000000000').replace(/\D/g, ''),
        transactionId: orderId,
        description: `Pedido ${orderId.slice(-6).toUpperCase()}`,
        projectWebhook: `${process.env.APP_URL || 'https://marketplace.frontmk.online'}/api/webhook/misticpay`
      };

      const response = await fetch(`${MISTIC_API_URL}/transactions/create`, {
        method: 'POST',
        headers: {
          'Authorization': getMisticAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json() as any;

      if (!response.ok) {
        console.error('Erro na Mistic Pay:', data);
        return res.status(response.status).json({ error: 'Erro ao gerar PIX com a Mistic Pay', details: data });
      }

      // Save order to Firestore
      const newOrder = {
        id: orderId,
        storeId,
        customerId,
        customerUsername: customerUsername || '',
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        status: 'pending',
        items,
        subtotal,
        total,
        gateway: 'misticpay',
        misticTransactionId: data.data.transactionId,
        paymentDetails: {
          qrCodeBase64: data.data.qrCodeBase64,
          copyPaste: data.data.copyPaste,
          qrcodeUrl: data.data.qrcodeUrl
        },
        shippingAddress,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      await orderRef.set(newOrder);

      res.json({
        success: true,
        orderId,
        qrCodeBase64: data.data.qrCodeBase64,
        copyPaste: data.data.copyPaste,
        qrcodeUrl: data.data.qrcodeUrl
      });
    } catch (err: any) {
      console.error('Checkout MisticPay Error:', err);
      res.status(500).json({ error: err.message || 'Erro interno do servidor' });
    }
  });

  // Webhook para atualizações de transação (Depósito)
  app.post('/api/webhook/misticpay', async (req, res) => {
    try {
      const payload = req.body;
      const { transactionId, status, value, transactionType } = payload;
      
      console.log('[MisticPay Webhook] Recebido:', JSON.stringify(payload));

      if (transactionType === 'DEPOSITO' && status === 'COMPLETO') {
        const db = getDb();
        
        // A documentação diz que podemos enviar o orderId no 'transactionId' na hora de criar.
        // Se a MisticPay retornar o nosso próprio transactionId (orderId) na notificação:
        const queryById = await db.collectionGroup('orders').where('id', '==', transactionId).get();
        const orderDoc = queryById.empty ? null : queryById.docs[0];
        const orderRef = orderDoc ? orderDoc.ref : null;
        
        if (orderDoc) {
          await orderRef.update({
            status: 'paid',
            paidAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
          console.log(`[MisticPay Webhook] Pedido ${transactionId} marcado como pago.`);
        } else {
          // Fallback: Tenta buscar onde misticTransactionId == transactionId (caso eles retornem o ID interno deles)
          const querySnapshot = await db.collectionGroup('orders').where('misticTransactionId', '==', transactionId).get();
          if (!querySnapshot.empty) {
            const docRef = querySnapshot.docs[0].ref;
            await docRef.update({
              status: 'paid',
              paidAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp()
            });
            console.log(`[MisticPay Webhook] Pedido (Busca secundária) marcado como pago.`);
          } else {
             console.warn(`[MisticPay Webhook] Pedido associado a transactionId ${transactionId} não encontrado.`);
          }
        }
      }

      res.status(200).send('OK');
    } catch (err) {
      console.error('[MisticPay Webhook] Erro:', err);
      res.status(500).send('Erro interno');
    }
  });

  // Consulta de Saldo Mistic Pay (Uso Global)
  app.get('/api/gateways/misticpay/balance', authMiddleware, async (req, res) => {
    try {
      const response = await fetch(`${MISTIC_API_URL}/users/balance`, {
        headers: {
          'Authorization': getMisticAuthHeader()
        }
      });
      const data = await response.json() as any;
      if (!response.ok) {
        return res.status(response.status).json({ error: 'Erro ao consultar saldo', details: data });
      }
      res.json({ balance: { available: data.data.balance, blocked: 0 } });
    } catch (err: any) {
      console.error('MisticPay Balance Error:', err);
      res.status(500).json({ error: err.message });
    }
  });
}
