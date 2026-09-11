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

      // Normaliza URL do webhook com esquema obrigatório
      let baseUrl = (process.env.APP_URL || '').trim();
      if (!baseUrl) {
        baseUrl = 'https://marketplace.frontmk.online';
      } else if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      baseUrl = baseUrl.replace(/\/+$/, '');

      // Chama a API da Mistic Pay
      const payload = {
        amount: total,
        payerName: customer.name || 'Cliente da Loja',
        payerDocument: (customer.document || '00000000000').replace(/\D/g, ''),
        transactionId: orderId,
        description: `Pedido ${orderId.slice(-6).toUpperCase()}`,
        projectWebhook: `${baseUrl}/api/webhook/misticpay`
      };

      const response = await fetch(`${MISTIC_API_URL}/transactions/create`, {
        method: 'POST',
        headers: {
          'Authorization': getMisticAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      let data: any = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { raw: text.substring(0, 500) };
      }
      
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
      const db = getDb();

      if (transactionType === 'DEPOSITO') {
        if (status === 'COMPLETO' || status === 'PAID') {
          // Busca pedido
          const queryById = await db.collectionGroup('orders').where('id', '==', transactionId).get();
          let orderDoc = queryById.empty ? null : queryById.docs[0];
          
          if (!orderDoc) {
             const querySnapshot = await db.collectionGroup('orders').where('misticTransactionId', '==', transactionId).get();
             if (!querySnapshot.empty) orderDoc = querySnapshot.docs[0];
          }

          if (orderDoc) {
            const data = orderDoc.data();
            if (data.status !== 'paid') {
              await orderDoc.ref.update({
                status: 'paid',
                paidAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
              });
              console.log(`[MisticPay Webhook] Pedido ${transactionId} marcado como pago.`);
            } else {
              console.log(`[MisticPay Webhook] Pedido ${transactionId} ja estava pago. (Idempotente)`);
            }
          }
        }
      } else if (transactionType === 'SAQUE' || transactionType === 'TRANSFERENCIA') {
         // Lida com atualização assíncrona de saque
         const queryById = await db.collectionGroup('withdrawals').where('id', '==', transactionId).get();
         let wDoc = queryById.empty ? null : queryById.docs[0];
         
         if (!wDoc) {
            const querySnapshot = await db.collectionGroup('withdrawals').where('misticTransactionId', '==', transactionId).get();
            if (!querySnapshot.empty) wDoc = querySnapshot.docs[0];
         }

         if (wDoc) {
            const data = wDoc.data();
            // Apenas atualiza se não for transição inválida (ex: já finalizado)
            if (data.status === 'processing' || data.status === 'pending') {
               let newStatus = data.status;
               if (status === 'COMPLETO' || status === 'SUCESSO' || status === 'COMPLETED') newStatus = 'completed';
               else if (status === 'FALHA' || status === 'REJEITADO' || status === 'FAILED' || status === 'CANCELLED') newStatus = 'failed';
               
               if (newStatus !== data.status) {
                  await wDoc.ref.update({
                     status: newStatus,
                     updatedAt: FieldValue.serverTimestamp()
                  });
                  console.log(`[MisticPay Webhook] Saque ${transactionId} atualizado para ${newStatus}.`);
               }
            }
         }
      }
      
      res.status(200).send('OK');
    } catch (err) {
      console.error('[MisticPay Webhook] Erro:', err);
      res.status(500).send('Erro interno');
    }
  });

  app.get('/api/gateways/misticpay/balance', authMiddleware, async (req, res) => {
    try {
      const response = await fetch(`${MISTIC_API_URL}/users/balance`, {
        headers: {
          'Authorization': getMisticAuthHeader()
        }
      });
      let data: any = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { raw: text.substring(0, 500) };
      }
      
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
