import express from 'express';
import { processEvent } from './server-notification-service.js';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { FinancialWalletService } from './server-financial-service';
import {
  parseAndValidateWebhookPayload,
  WebhookService,
  webhookRateLimiter,
  constantTimeCompare,
  canTransitionState
} from './server-webhook-service';

export function setupMisticPayRoutes(app: express.Express, authMiddleware: any, getDb: any) {
  const MISTIC_API_URL = 'https://api.misticpay.com/api';

  // Helper para header de autenticação Basic oficial (Client ID + Client Secret)
  const getMisticAuthHeader = () => {
    const clientId = process.env.MISTIC_PAY_CLIENT_ID;
    const clientSecret = process.env.MISTIC_PAY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('As chaves do Mistic Pay não estão configuradas (MISTIC_PAY_CLIENT_ID e MISTIC_PAY_CLIENT_SECRET).');
    }

    const base64Auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    return `Basic ${base64Auth}`;
  };

  interface MisticActiveCheckResult {
    status: 'SUCCESS' | 'REJECTED' | 'NOT_FOUND' | 'UNAVAILABLE' | 'INVALID_RESPONSE' | 'PENDING';
    state?: string;
    reason?: string;
    data?: any;
  }

  /**
   * Consulta ativa e autoritativa de transação na MisticPay (Double-Check de Segurança)
   * Impede que webhooks forjados ou inconclusivos aprovem pagamentos sem confirmação real no gateway.
   */
  const checkTransactionWithMistic = async (transactionId: string): Promise<MisticActiveCheckResult> => {
    // Proibido em produção! Bypass permitido estritamente em testes locais com NODE_ENV !== 'production'
    if (process.env.NODE_ENV !== 'production' && process.env.MISTIC_PAY_SKIP_ACTIVE_CHECK === 'true') {
      return {
        status: 'SUCCESS',
        state: 'COMPLETO',
        data: { transaction: { transactionId, transactionState: 'COMPLETO' } }
      };
    }

    let authHeader: string;
    try {
      authHeader = getMisticAuthHeader();
    } catch (authErr: any) {
      console.error(`[MisticPay Active Check] Falha de credenciais ao verificar ${transactionId}:`, authErr.message);
      return { status: 'UNAVAILABLE', reason: 'Credenciais da MisticPay ausentes ou incompletas no servidor' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout defensivo

    try {
      const response = await fetch(`${MISTIC_API_URL}/transactions/check`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'ci': process.env.MISTIC_PAY_CLIENT_ID || '',
          'cs': process.env.MISTIC_PAY_CLIENT_SECRET || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transactionId }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.status === 404) {
        return { status: 'NOT_FOUND', reason: 'Transação não encontrada no gateway MisticPay.' };
      }

      if (!response.ok) {
        console.warn(`[MisticPay Active Check] Gateway retornou HTTP ${response.status} ao consultar transação ${transactionId}`);
        return { status: 'UNAVAILABLE', reason: `Gateway HTTP ${response.status}` };
      }

      const data: any = await response.json();
      const transaction = data?.data || data?.transaction || data;
      const state = String(transaction?.transactionState || transaction?.status || '').toUpperCase();

      if (state === 'COMPLETO' || state === 'PAID' || state === 'SUCESSO' || state === 'COMPLETED') {
        return { status: 'SUCCESS', state, data };
      } else if (state === 'PENDENTE' || state === 'PENDING' || state === 'WAITING' || state === 'AGUARDANDO') {
        return { status: 'PENDING', state, data };
      } else if (
        state === 'FALHA' ||
        state === 'CANCELADO' ||
        state === 'REJEITADO' ||
        state === 'EXPIRED' ||
        state === 'FAILED'
      ) {
        return { status: 'REJECTED', state, data };
      } else {
        return { status: 'INVALID_RESPONSE', state, reason: `Estado inconclusivo do gateway: ${state}` };
      }
    } catch (err: any) {
      clearTimeout(timeout);
      const isTimeout = err.name === 'AbortError';
      const reason = isTimeout ? 'Timeout na consulta autoritativa do gateway' : (err.message || 'Erro de rede na consulta autoritativa');
      console.error(`[MisticPay Active Check] ${reason} para transação ${transactionId}`);
      return { status: 'UNAVAILABLE', reason };
    }
  };

  // Endpoint para Checkout - Gera QR Code PIX via MisticPay
  app.post('/api/checkout/misticpay', async (req, res) => {
    try {
      const { storeId, customerId, customerUsername, items, subtotal, total, customer, shippingAddress } = req.body;
      const db = getDb();

      if (!storeId || !total || total <= 0) {
        return res.status(400).json({ error: 'Dados de checkout inválidos (storeId e total obrigatórios).' });
      }

      // Validação de loja existente
      const storeDoc = await db.collection('stores').doc(storeId).get();
      if (!storeDoc.exists) {
        return res.status(404).json({ error: 'Loja não encontrada.' });
      }

      // Validação e Resolução Estrita de Preços no Backend (Anti-Price-Manipulation)
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'O carrinho deve conter pelo menos um item.' });
      }

      let calculatedSubtotalCents = 0;
      const verifiedItems: any[] = [];

      for (const item of items) {
        const productId = item.productId || item.id;
        const rawQty = item.quantity;
        const quantity = Math.floor(Number(rawQty));

        if (!productId || typeof productId !== 'string' || quantity < 1 || quantity > 1000) {
          return res.status(400).json({ error: 'Itens do carrinho inválidos ou quantidade fora dos limites permitidos.' });
        }

        const productDoc = await db.collection('stores').doc(storeId).collection('products').doc(productId).get();
        if (!productDoc.exists) {
          return res.status(400).json({ error: `Produto ${productId} não encontrado ou indisponível nesta loja.` });
        }

        const productData = productDoc.data() || {};
        if (productData.active === false) {
          return res.status(400).json({ error: `O produto "${productData.name || productId}" está inativo.` });
        }

        const realPrice = Math.round(Number(productData.price || 0) * 100) / 100;
        if (realPrice <= 0 || isNaN(realPrice)) {
          return res.status(400).json({ error: `Preço inválido para o produto "${productData.name}".` });
        }

        const itemCents = Math.round(realPrice * 100) * quantity;
        calculatedSubtotalCents += itemCents;

        verifiedItems.push({
          productId,
          name: productData.name || item.name || 'Produto',
          price: realPrice,
          quantity,
          sku: productData.sku || item.sku || '',
          image: productData.images?.[0] || item.image || ''
        });
      }

      const calculatedTotal = Math.round(calculatedSubtotalCents) / 100;
      const clientTotal = Math.round(Number(total) * 100) / 100;

      // Se o total enviado pelo frontend diferir do total calculado pelo backend, rejeita imediatamente
      if (Math.abs(clientTotal - calculatedTotal) > 0.05) {
        console.warn(`[Checkout Security] Divergência de preço detectada na loja ${storeId}: Enviado R$ ${clientTotal}, Calculado R$ ${calculatedTotal}`);
        return res.status(400).json({
          error: 'Divergência no cálculo de valores do pedido. Preços atualizados pelo servidor.',
          code: 'PRICE_MANIPULATION_DETECTED',
          expectedTotal: calculatedTotal
        });
      }

      // Criação da ordem preliminar para obter ID determinístico
      const orderRef = db.collection('stores').doc(storeId).collection('orders').doc();
      const orderId = orderRef.id;

      // Normaliza URL do webhook com token de segurança se configurado
      let baseUrl = (process.env.APP_URL || '').trim();
      if (!baseUrl) {
        const host = req.get('x-forwarded-host') || req.get('host');
        if (host) {
          baseUrl = `https://${host}`;
        } else {
          baseUrl = 'https://marketplace.frontmk.online';
        }
      } else if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      baseUrl = baseUrl.replace(/\/+$/, '');

      const webhookSecret = (process.env.MISTIC_PAY_WEBHOOK_SECRET || '').trim();
      if (!webhookSecret) {
        console.error('[MisticPay Checkout] Falha de configuração: MISTIC_PAY_WEBHOOK_SECRET não configurado no servidor.');
        return res.status(503).json({
          error: 'Serviço temporariamente indisponível: configuração de segurança do gateway incompleta.',
          code: 'GATEWAY_CONFIG_MISSING'
        });
      }

      const projectWebhook = `${baseUrl}/api/webhook/misticpay?token=${encodeURIComponent(webhookSecret)}`;

      // Chama a API da Mistic Pay com payload oficial usando SEMPRE o total calculado pelo backend
      const payload = {
        amount: calculatedTotal,
        payerName: customer?.name || 'Cliente da Loja',
        payerDocument: (customer?.document || '00000000000').replace(/\D/g, ''),
        transactionId: orderId,
        description: `Pedido ${orderId.slice(-6).toUpperCase()}`,
        projectWebhook
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
        console.error('[MisticPay Checkout] Erro no gateway:', data);
        return res.status(response.status).json({ error: 'Erro ao gerar PIX com a Mistic Pay', details: data });
      }

      const misticTxId = data.data?.transactionId || null;

      // Salva pedido no Firestore com estado 'pending' e itens verificados
      const newOrder = {
        id: orderId,
        storeId,
        customerId: customerId || '',
        customerUsername: customerUsername || '',
        customer: customer || {},
        status: 'pending',
        items: verifiedItems,
        subtotal: calculatedTotal,
        total: calculatedTotal,
        gateway: 'misticpay',
        misticTransactionId: misticTxId,
        paymentDetails: {
          qrCodeBase64: data.data?.qrCodeBase64 || '',
          copyPaste: data.data?.copyPaste || '',
          qrcodeUrl: data.data?.qrcodeUrl || ''
        },
        shippingAddress: shippingAddress || {},
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      await orderRef.set(newOrder);

      import('./server-notification-service.js').then(({ processEvent }) => {
        processEvent({
          eventId: 'CREATED_' + orderId,
          type: 'ORDER_CREATED',
          storeId,
          orderId,
          source: 'checkout',
          occurredAt: new Date().toISOString()
        }).catch(console.error);
      });

      res.json({
        success: true,
        orderId,
        qrCodeBase64: data.data?.qrCodeBase64,
        copyPaste: data.data?.copyPaste,
        qrcodeUrl: data.data?.qrcodeUrl
      });
    } catch (err: any) {
      console.error('[MisticPay Checkout] Falha inesperada:', err);
      res.status(500).json({ error: err.message || 'Erro interno do servidor' });
    }
  });


  /**
   * Consulta ativa de status da transação na Mistic Pay
   */

  app.post('/api/checkout/misticpay/cancel', express.json(), async (req, res) => {
    try {
      const { storeId, orderId } = req.body;
      if (!storeId || !orderId) return res.status(400).json({ error: 'Missing params' });
      
      const db = getDb();
      const orderRef = db.collection('stores').doc(storeId).collection('orders').doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) return res.status(404).json({ error: 'Not found' });
      
      const data = orderSnap.data();
      if (data.status === 'pending') {
        await orderRef.update({ status: 'refunded', updatedAt: FieldValue.serverTimestamp(), refundedAt: FieldValue.serverTimestamp(), refundReason: 'MisticPay Refund' });
      processEvent({
        eventId: 'REFUND_' + orderId,
        type: 'ORDER_REFUNDED',
        storeId,
        orderId,
        source: 'misticpay',
        occurredAt: new Date().toISOString()
      }).catch(console.error);
      
      }
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[MisticPay] Refund error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/checkout/misticpay/status', express.json(), async (req, res) => {
    try {
      const { storeId, orderId } = req.body;
      if (!storeId || !orderId) {
        return res.status(400).json({ error: 'storeId e orderId são obrigatórios' });
      }

      const db = getDb();
      const orderRef = db.collection('stores').doc(storeId).collection('orders').doc(orderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }

      const orderData = orderDoc.data();
      if (orderData.status === 'paid' || orderData.status === 'processing' || orderData.status === 'shipped' || orderData.status === 'delivered') {
        return res.json({ status: orderData.status });
      }

      const misticTxId = orderData.misticTransactionId;
      if (!misticTxId) {
        return res.status(400).json({ error: 'Pedido não possui transação MisticPay vinculada' });
      }

      const check = await checkTransactionWithMistic(String(misticTxId));
      if (check.state === 'COMPLETO' || check.status === 'SUCCESS') {
        // Atualiza a máquina de estados para aprovar a compra
        
        
        await db.runTransaction(async (t: any) => {
          const freshOrder = await t.get(orderRef);
          const freshData = freshOrder.data();
          if (freshData.status !== 'pending' && freshData.status !== 'pending_verification') {
            return;
          }
          t.update(orderRef, { status: 'paid',
            updatedAt: new Date()
          });
        });

        // Liberação dos valores na carteira
        try {
          await FinancialWalletService.creditPayment(db, {
            storeId: storeId,
            orderId: orderId,
            amountCents: Math.round(orderData.total * 100)
          });
        } catch (walletErr) {
          console.error('[MisticPay Sync] Erro ao atualizar carteira do logista:', walletErr);
        }

        Promise.all([
          processEvent({
            eventId: 'PAID_' + orderId,
            type: 'ORDER_PAYMENT_CONFIRMED',
            storeId,
            orderId,
            source: 'misticpay',
            occurredAt: new Date().toISOString()
          }),
          processEvent({
            eventId: 'SALE_' + orderId,
            type: 'SALE_CREATED',
            storeId,
            orderId,
            source: 'misticpay',
            occurredAt: new Date().toISOString()
          })
        ]).catch(console.error);
        return res.json({ status: 'paid' });
      }

      return res.json({ status: orderData.status, gatewayState: check.state });
    } catch (err: any) {
      console.error('[MisticPay Sync] Falha:', err);
      return res.status(500).json({ error: err.message });
    }
  });


  /**
   * Consulta ativa de status da transação de SAQUE na Mistic Pay
   */
  app.post('/api/misticpay/withdrawals/status', express.json(), async (req, res) => {
    try {
      // Autenticação
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado. Token ausente.' });
      }
      const token = authHeader.split('Bearer ')[1];
      const { getAuth } = require('firebase-admin/auth');
      const { getFirebaseAdmin, getAdminDb } = require('./server-firebase-admin.js');
      const admin = getFirebaseAdmin();
      const decodedToken = await getAuth(admin).verifyIdToken(token);
      
      const { storeId, withdrawalId } = req.body;
      if (!storeId || !withdrawalId) {
        return res.status(400).json({ error: 'storeId e withdrawalId são obrigatórios' });
      }
      
      // Validação de Ownership
      const db = getAdminDb();
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();
      const userStores = userData?.stores || [];
      if (!userStores.includes(storeId)) {
        return res.status(403).json({ error: 'Acesso negado à loja ou tenant incorreto.' });
      }

      
      
      const result = await FinancialWalletService.reconcileWithdrawal(db, { storeId, withdrawalId });
      
      return res.json(result);
    } catch (err: any) {
      console.error('[MisticPay Sync Saque] Falha:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * Webhook Financeiro Seguro MisticPay
   * Atende aos requisitos rigorosos de:
   * 1. Autenticação e Token Secret (quando configurado) com Fail-Closed
   * 2. Sanitização de payload, limite de tamanho (256KB) e proteção contra prototype pollution
   * 3. Rate limiting contra flooding
   * 4. Validação de Tenant / Propriedade de Loja
   * 5. Verificação ativa com a API da MisticPay (Double-Check autoritativo)
   * 6. Validação de valor do pedido vs valor pago (em centavos e reais)
   * 7. Máquina de estados financeira (impede reversão de 'paid' para 'pending')
   * 8. Idempotência transacional atômica via Firestore (`webhookEvents/misticpay:{eventId}`)
   * 9. Retenção obrigatória D+3 (72h completas) em pendingBalanceCents (sem crédito imediato)
   */
  const handleMisticWebhook = async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

    // 1. Rate Limiting defensivo
    if (!webhookRateLimiter.isAllowed(`misticpay:${clientIp}`, 120, 60000)) {
      console.warn(`[MisticPay Webhook] Rate limit excedido para IP: ${clientIp}`);
      return res.status(429).json({ error: 'Too Many Requests' });
    }

    // 2. Validação de Autenticação / Webhook Secret (Fail-Closed Obrigatório)
    const configuredSecret = (process.env.MISTIC_PAY_WEBHOOK_SECRET || '').trim();
    if (!configuredSecret) {
      console.error(`[MisticPay Webhook] Erro crítico: MISTIC_PAY_WEBHOOK_SECRET não configurado no servidor. Rejeitando requisição (Fail-Closed 503).`);
      return res.status(503).json({
        error: 'Service Unavailable: Webhook processing configuration is missing on server.',
        code: 'WEBHOOK_CONFIG_MISSING'
      });
    }

    const incomingToken = (
      (req.query.token as string) ||
      (req.headers['x-webhook-secret'] as string) ||
      (req.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '') ||
      ''
    ).trim();

    if (!incomingToken || !constantTimeCompare(incomingToken, configuredSecret)) {
      console.warn(`[MisticPay Webhook] Falha de autenticação (Token inválido ou ausente) de ${clientIp}. Abortando processamento (Fail-Closed).`);
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing webhook token.' });
    }

    // 3. Captura e validação segura do Payload Bruto
    let rawBuffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      rawBuffer = req.body;
    } else if (typeof req.body === 'string') {
      rawBuffer = Buffer.from(req.body, 'utf8');
    } else if (req.body && typeof req.body === 'object') {
      rawBuffer = Buffer.from(JSON.stringify(req.body), 'utf8');
    } else {
      rawBuffer = Buffer.alloc(0);
    }

    let parsedPayload: any;
    let payloadHash: string;

    try {
      const validation = parseAndValidateWebhookPayload(rawBuffer, 256 * 1024);
      parsedPayload = validation.payload;
      payloadHash = validation.payloadHash;
    } catch (valErr: any) {
      console.error('[MisticPay Webhook] Payload inválido:', valErr.message);
      return res.status(valErr.statusCode || 400).json({ error: valErr.message });
    }


    const rawObj = Array.isArray(parsedPayload) ? parsedPayload[0] : parsedPayload;
    const unwrapped = rawObj?.data || rawObj?.transaction || rawObj || {};
    
    const transactionId = unwrapped.transactionId || rawObj.transactionId;
    const status = unwrapped.status || unwrapped.transactionState || rawObj.status || rawObj.transactionState;
    const value = unwrapped.value || unwrapped.amount || rawObj.value || rawObj.amount;
    const transactionType = unwrapped.transactionType || rawObj.transactionType || rawObj.event;
    const e2e = unwrapped.e2e || unwrapped.e2eId || rawObj.e2e || rawObj.e2eId;
    const rawEventName = rawObj.event || rawObj.eventType || unwrapped.event || unwrapped.eventType;

    console.log('[MisticPay Webhook] Raw Payload debug:', JSON.stringify(parsedPayload).substring(0, 500));


    const db = getDb();

    // EventId determinístico para controle de idempotência
    const rawTxId = transactionId ? String(transactionId) : (e2e ? String(e2e) : null);
    const eventId = rawTxId || payloadHash;
    const eventType = String(rawEventName || transactionType || 'UNKNOWN').toUpperCase();

    console.log(`[MisticPay Webhook] Evento recebido: Tipo=${eventType}, ID=${eventId}, Status=${status}`);

    try {
      // -------------------------------------------------------------
      // CASO 1: DEPÓSITO PIX (CASH-IN)
      // -------------------------------------------------------------
      const isDepositEvent = eventType === 'DEPOSITO' || transactionType === 'DEPOSITO' || eventType === 'RECEBIMENTO' || eventType === 'UNKNOWN' || eventType === 'PAYMENT';
      if (isDepositEvent) {
        const isPaymentComplete = status === 'COMPLETO' || status === 'PAID' || status === 'COMPLETED' || status === 'SUCESSO' || String(status).toUpperCase() === 'COMPLETO';

        // Localiza o pedido correspondente no Firestore
        let orderDoc: any = null;

        if (transactionId) {
          // Busca direta por ID interno do pedido
          const queryById = await db.collectionGroup('orders').where('id', '==', String(transactionId)).get();
          if (!queryById.empty) {
            orderDoc = queryById.docs[0];
          }

          // Se não encontrou por ID, busca por misticTransactionId
          if (!orderDoc) {
            const queryByMistic = await db.collectionGroup('orders').where('misticTransactionId', '==', transactionId).get();
            if (!queryByMistic.empty) {
              orderDoc = queryByMistic.docs[0];
            } else if (typeof transactionId === 'string' && !isNaN(Number(transactionId))) {
              const queryByMisticNum = await db.collectionGroup('orders').where('misticTransactionId', '==', Number(transactionId)).get();
              if (!queryByMisticNum.empty) {
                orderDoc = queryByMisticNum.docs[0];
              }
            }
          }
        }

        if (!orderDoc) {
          console.warn(`[MisticPay Webhook] Pedido não localizado para transactionId: ${transactionId}`);
          return res.status(200).json({ status: 'ignored_order_not_found', eventId });
        }

        const orderData = orderDoc.data();
        const storeId = orderData.storeId;
        const orderId = orderDoc.id;

        // Validação estrita de Tenant e Loja
        if (!storeId) {
          console.error(`[MisticPay Webhook] Pedido ${orderId} corrompido (sem storeId associado).`);
          return res.status(400).json({ error: 'Pedido sem loja associada.' });
        }

        const storeSnap = await db.collection('stores').doc(storeId).get();
        if (!storeSnap.exists) {
          console.error(`[MisticPay Webhook] Loja ${storeId} não existe no banco de dados.`);
          return res.status(404).json({ error: 'Loja associada ao pedido não encontrada.' });
        }

        // Validação da Máquina de Estados: Se já está pago, idempotência imediata
        if (orderData.status === 'paid') {
          console.log(`[MisticPay Webhook] Pedido ${orderId} já está pago. Resposta idempotente (200).`);
          return res.status(200).json({ status: 'already_paid', orderId, eventId });
        }

        // Transição inválida: pedidos cancelados ou estornados não podem ser marcados como pagos
        if (!canTransitionState('payment', orderData.status || 'pending', 'paid')) {
          console.error(`[MisticPay Webhook] Transição inválida: pedido ${orderId} no estado '${orderData.status}' não pode ir para 'paid'.`);
          return res.status(409).json({
            error: `Transição inválida de '${orderData.status}' para 'paid'.`,
            code: 'STATE_TRANSITION_CONFLICT'
          });
        }

        // Se o status no webhook for COMPLETO/PAID, executa a verificação ativa autoritativa
        if (isPaymentComplete) {
          // 1. Verificação do Valor
          const expectedTotalCents = Math.round((Number(orderData.total) || 0) * 100);
          if (value !== undefined && value !== null) {
            const rawValNum = Number(value);
            const valAsCents = Math.round(rawValNum * 100);
            const isMatch = (valAsCents === expectedTotalCents) || (Math.round(rawValNum) === expectedTotalCents);

            if (!isMatch && expectedTotalCents > 0) {
              console.error(`[MisticPay Webhook] DIVERGÊNCIA DE VALOR! Pedido: R$ ${(expectedTotalCents / 100).toFixed(2)}, Webhook: ${value}`);
              return res.status(400).json({
                error: 'Valor do webhook divergente do total do pedido.',
                code: 'AMOUNT_MISMATCH'
              });
            }
          }

          // 2. Verificação Ativa de Segurança com a API Oficial da MisticPay (Double-Check Autoritativo Obrigatório)
          const misticCheckTxId = String(orderData.misticTransactionId || transactionId);
          const activeCheck = await checkTransactionWithMistic(misticCheckTxId);

          if (activeCheck.status === 'REJECTED') {
            console.warn(`[MisticPay Webhook] Verificação ativa rejeitou: estado no gateway é '${activeCheck.state}' (esperado COMPLETO).`);
            return res.status(400).json({
              error: 'Transação não confirmada como completa pela API autoritativa do gateway.',
              code: 'ACTIVE_CHECK_FAILED',
              state: activeCheck.state
            });
          }

          if (activeCheck.status === 'NOT_FOUND') {
            console.warn(`[MisticPay Webhook] Transação ${misticCheckTxId} não encontrada na API da MisticPay.`);
            return res.status(404).json({
              error: 'Transação não encontrada no gateway MisticPay.',
              code: 'TRANSACTION_NOT_FOUND'
            });
          }

          if (activeCheck.status === 'PENDING') {
            console.warn(`[MisticPay Webhook] Race condition no gateway detectada: API retornou PENDENTE, mas Webhook diz COMPLETO. Solicitando retry.`);
            return res.status(409).json({
              error: 'Transação ainda consta como pendente na API. Tente novamente em breve.',
              code: 'ACTIVE_CHECK_PENDING_RETRY'
            });
          }

          if (activeCheck.status !== 'SUCCESS') {
            // Se o active check falhar por timeout, 500, indisponibilidade de rede ou resposta inválida:
            // Regra Fail-Closed: NÃO confirmar pagamento, NÃO creditar wallet, NÃO liberar saldo, NÃO iniciar D+3!
            // Registra o pedido como pending_verification e o evento como reconciliation_required
            console.warn(`[MisticPay Webhook] Active check inconclusivo (${activeCheck.status}: ${activeCheck.reason}). Marcando pedido ${orderId} para reconciliação.`);

            await orderDoc.ref.update({
              status: 'pending_verification',
              reconciliationRequired: true,
              lastVerificationError: activeCheck.reason || activeCheck.status,
              verificationAttemptedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp()
            });

            await WebhookService.claimEvent(db, {
              provider: 'misticpay',
              eventId,
              eventType: 'DEPOSITO',
              payloadHash,
              entityId: orderId,
              tenantId: storeId,
              userId: orderData.customerId || null
            });

            await WebhookService.finalizeEvent(db, {
              provider: 'misticpay',
              eventId,
              status: 'failed',
              metadata: {
                orderId,
                storeId,
                reason: activeCheck.reason || activeCheck.status
              }
            });

            return res.status(503).json({
              status: 'failed',
              message: 'Não foi possível obter confirmação autoritativa do gateway no momento. Operação retida para reconciliação segura.',
              code: 'ACTIVE_CHECK_UNAVAILABLE'
            });
          }

          // 3. Claim Atômico do Evento de Webhook
          const claim = await WebhookService.claimEvent(db, {
            provider: 'misticpay',
            eventId,
            eventType: 'DEPOSITO',
            payloadHash,
            entityId: orderId,
            tenantId: storeId,
            userId: orderData.customerId || null
          });

          if (claim.alreadyProcessed) {
            console.log(`[MisticPay Webhook] Evento ${eventId} já processado anteriormente.`);
            return res.status(200).json({ status: 'already_processed', eventId });
          }

          if (claim.securityConflict) {
            console.error(`[MisticPay Webhook] Conflito de segurança para o evento ${eventId}`);
            return res.status(409).json({ error: 'Security conflict: duplicate event ID with altered payload.' });
          }

          // 4. Marca o pedido como pago atomicamente
          await orderDoc.ref.update({
            status: 'paid',
            paidAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
          console.log(`[MisticPay Webhook] Pedido ${orderId} marcado como pago.`);

          // 5. Credita a carteira com D+3 (72h) de retenção obrigatória
          const method = orderData.paymentMethod || 'pix';
          let feeCents = Math.round(expectedTotalCents * 0.07);
          if (method === 'credit_card' || method === 'debit_card') feeCents = Math.round(expectedTotalCents * 0.13);
          else if (method === 'boleto') feeCents = Math.round(expectedTotalCents * 0.09);

          const creditResult = await FinancialWalletService.creditPayment(db, {
            storeId,
            orderId,
            amountCents: expectedTotalCents,
            feeCents,
            paymentMethod: method,
            idempotencyKey: `mistic-paid-${eventId}`
          });

          // 6. Finaliza o registro do evento
          await WebhookService.finalizeEvent(db, {
            provider: 'misticpay',
            eventId,
            status: 'processed',
            metadata: {
              orderId,
              storeId,
              amountCents: expectedTotalCents,
              releaseAt: creditResult.releaseAt
            }
          });

          console.log(`[MisticPay Webhook] Sucesso! Pedido ${orderId} pago, D+3 agendado: ${creditResult.releaseAt}`);

          Promise.all([
            processEvent({
              eventId: 'PAID_' + orderId,
              type: 'ORDER_PAYMENT_CONFIRMED',
              storeId,
              orderId,
              source: 'misticpay_webhook',
              occurredAt: new Date().toISOString()
            }),
            processEvent({
              eventId: 'SALE_' + orderId,
              type: 'SALE_CREATED',
              storeId,
              orderId,
              source: 'misticpay_webhook',
              occurredAt: new Date().toISOString()
            })
          ]).catch(console.error);

          return res.status(200).json({
            success: true,
            orderId,
            status: 'paid',
            eventId,
            durationMs: Date.now() - startTime
          });
        }

        return res.status(200).json({ status: 'received_non_final_status', eventId });
      }

      // -------------------------------------------------------------
      // CASO 2: RETIRADA / SAQUE PIX (CASH-OUT)
      // -------------------------------------------------------------
      if (
        eventType === 'RETIRADA' || 
        eventType === 'SAQUE' || 
        eventType === 'TRANSFERENCIA' ||
        transactionType === 'RETIRADA' ||
        transactionType === 'SAQUE'
      ) {
        let wDoc: any = null;

        // Busca por misticTransactionId
        const queryByMistic = await db.collectionGroup('withdrawals').where('misticTransactionId', '==', transactionId).get();
        if (!queryByMistic.empty) {
          wDoc = queryByMistic.docs[0];
        } else if (typeof transactionId === 'string' && !isNaN(Number(transactionId))) {
          const queryByNum = await db.collectionGroup('withdrawals').where('misticTransactionId', '==', Number(transactionId)).get();
          if (!queryByNum.empty) wDoc = queryByNum.docs[0];
        }

        // Busca por ID do documento de saque
        if (!wDoc && transactionId) {
          const queryById = await db.collectionGroup('withdrawals').where('id', '==', String(transactionId)).get();
          if (!queryById.empty) wDoc = queryById.docs[0];
        }

        if (!wDoc) {
          console.warn(`[MisticPay Webhook] Saque não encontrado para transactionId: ${transactionId}`);
          return res.status(200).json({ status: 'ignored_withdrawal_not_found', eventId });
        }

        const wData = wDoc.data();
        const storeId = wData.storeId;
        const withdrawalId = wDoc.id;

        // Validação da Máquina de Estados: Estados finais não regridem nem se repetem
        if (wData.status === 'completed' || wData.status === 'failed') {
          console.log(`[MisticPay Webhook] Saque ${withdrawalId} já em estado final (${wData.status}). Idempotente.`);
          return res.status(200).json({ status: 'already_finalized', withdrawalId, eventId });
        }

        const normStatus = String(status || '').toUpperCase();

        if (normStatus === 'COMPLETO' || normStatus === 'SUCESSO' || normStatus === 'PAID' || normStatus === 'COMPLETED') {
          // Validação de transição de estado
          if (!canTransitionState('withdrawal', wData.status || 'processing', 'completed')) {
            console.error(`[MisticPay Webhook] Transição de saque inválida: de '${wData.status}' para 'completed'.`);
            return res.status(409).json({ error: 'Transição de saque inválida.' });
          }

          // Consulta Autoritativa MisticPay API antes de confirmar o webhook financeiro
          const activeCheck = await checkTransactionWithMistic(String(transactionId));
          if (activeCheck.status !== 'SUCCESS' || activeCheck.state !== 'COMPLETO') {
             console.error(`[MisticPay Webhook] Falha na verificação autoritativa do saque ${withdrawalId}: Estado: ${activeCheck.state}`);
             return res.status(422).json({ error: 'MisticPay API não confirma transação como COMPLETO.' });
          }

          const claim = await WebhookService.claimEvent(db, {
            provider: 'misticpay',
            eventId,
            eventType: 'RETIRADA',
            payloadHash,
            entityId: withdrawalId,
            tenantId: storeId
          });

          if (claim.alreadyProcessed) {
            return res.status(200).json({ status: 'already_processed', eventId });
          }

          await FinancialWalletService.confirmWithdrawal(db, {
            storeId,
            withdrawalId,
            misticTransactionId: transactionId
          });

          await WebhookService.finalizeEvent(db, {
            provider: 'misticpay',
            eventId,
            status: 'processed',
            metadata: { withdrawalId, storeId, finalStatus: 'completed' }
          });

          console.log(`[MisticPay Webhook] Saque ${withdrawalId} confirmado na carteira com sucesso.`);
          return res.status(200).json({ success: true, withdrawalId, status: 'completed', eventId });

        } else if (
          normStatus === 'FALHA' || 
          normStatus === 'REJEITADO' || 
          normStatus === 'FAILED' || 
          normStatus === 'CANCELLED' || 
          normStatus === 'CANCELADO'
        ) {
          if (!canTransitionState('withdrawal', wData.status || 'processing', 'failed')) {
            console.error(`[MisticPay Webhook] Transição de saque inválida: de '${wData.status}' para 'failed'.`);
            return res.status(409).json({ error: 'Transição de saque inválida.' });
          }

          const claim = await WebhookService.claimEvent(db, {
            provider: 'misticpay',
            eventId,
            eventType: 'RETIRADA',
            payloadHash,
            entityId: withdrawalId,
            tenantId: storeId
          });

          if (claim.alreadyProcessed) {
            return res.status(200).json({ status: 'already_processed', eventId });
          }

          await FinancialWalletService.releaseWithdrawalReservation(db, {
            storeId,
            withdrawalId,
            reason: `Rejeitado pelo provedor via Webhook (${status})`
          });

          await WebhookService.finalizeEvent(db, {
            provider: 'misticpay',
            eventId,
            status: 'processed',
            metadata: { withdrawalId, storeId, finalStatus: 'failed' }
          });

          console.log(`[MisticPay Webhook] Saque ${withdrawalId} recusado e saldo liberado.`);
          return res.status(200).json({ success: true, withdrawalId, status: 'failed', eventId });
        }

        return res.status(200).json({ status: 'received_non_terminal_withdrawal_status', eventId });
      }

      // -------------------------------------------------------------
      // CASO 3: INFRAÇÃO PIX (MED - MECANISMO ESPECIAL DE DEVOLUÇÃO)
      // -------------------------------------------------------------
      if (eventType === 'INFRACTION' || rawEventName === 'INFRACTION') {
        console.warn(`[MisticPay Webhook] Notificação de Infração (MED) recebida:`, eventId);
        
        await WebhookService.claimEvent(db, {
          provider: 'misticpay',
          eventId,
          eventType: 'INFRACTION',
          payloadHash
        });

        await WebhookService.finalizeEvent(db, {
          provider: 'misticpay',
          eventId,
          status: 'processed',
          metadata: { details: 'MED registered' }
        });

        return res.status(200).json({ success: true, eventId, status: 'med_logged' });
      }

      // Evento desconhecido recebido de forma segura
      console.log(`[MisticPay Webhook] Evento desconhecido ou não acionável recebido: ${eventType}`);
      return res.status(200).json({ status: 'ignored_unrecognized_event', eventId });

    } catch (err: any) {
      console.error('[MisticPay Webhook] Falha interna crítica no processamento:', err);
      return res.status(500).json({
        error: 'Erro interno ao processar webhook.',
        code: 'INTERNAL_WEBHOOK_ERROR'
      });
    }
  };

  // Registra as rotas canônicas e de alias do webhook
  app.post('/api/webhook/misticpay', express.raw({ type: '*/*', limit: '256kb' }), handleMisticWebhook);
  app.post('/api/webhooks/misticpay', express.raw({ type: '*/*', limit: '256kb' }), handleMisticWebhook);

  // Consulta administrativa de saldo do gateway (Apenas administradores da plataforma)
  app.get('/api/gateways/misticpay/balance', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || !user.uid) {
        return res.status(401).json({ error: 'Não autenticado.', code: 'UNAUTHORIZED' });
      }

      const db = getDb();
      const userDoc = await db.collection('users').doc(user.uid).get();
      const userData = userDoc.data() || {};
      const isAdmin = userData.role === 'admin' || userData.isAdmin === true || user.admin === true;

      if (!isAdmin) {
        console.warn(`[Security Alert] Tentativa não autorizada de consulta de saldo gateway pelo usuário ${user.uid}`);
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem consultar saldos de gateway.', code: 'FORBIDDEN' });
      }

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
      res.json({ balance: { available: data.data?.balance || 0, blocked: 0 } });
    } catch (err: any) {
      console.error('[MisticPay Balance] Erro:', err.message);
      res.status(500).json({ error: 'Erro interno ao consultar saldo.' });
    }
  });
}
