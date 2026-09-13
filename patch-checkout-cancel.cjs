const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

const search = `      const data = orderSnap.data();
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
        
      }`;

const replace = `      const data = orderSnap.data();
      // Validação de Autorização de Negócio e IDOR: 
      // Somente pedidos "pending" podem ser cancelados publicamente via timeout do checkout.
      // IDs do Firestore são criptograficamente seguros (unguessable), 
      // mas validamos adicionalmente o tempo de vida do pedido (ex: máx 1 hora) para evitar abusos futuros.
      const orderAgeMs = data.createdAt ? (Date.now() - data.createdAt.toMillis()) : 0;
      if (orderAgeMs > 60 * 60 * 1000) {
        return res.status(403).json({ error: 'Pedido muito antigo para ser cancelado via timeout de checkout.' });
      }

      if (data.status === 'pending' || data.status === 'pending_verification') {
        await orderRef.update({ status: 'canceled', updatedAt: require('firebase-admin/firestore').FieldValue.serverTimestamp() });
        import('./server-notification-service.js').then(({ processEvent }) => {
          processEvent({
            eventId: 'CANCEL_' + orderId,
            type: 'ORDER_CANCELLED',
            storeId,
            orderId,
            source: 'misticpay_timeout',
            occurredAt: new Date().toISOString()
          }).catch(console.error);
        });
      } else {
        return res.status(409).json({ error: 'Pedido não está pendente.' });
      }`;

if (code.includes(search)) {
  code = code.replace(search, replace);
}

fs.writeFileSync('server-misticpay.ts', code);
