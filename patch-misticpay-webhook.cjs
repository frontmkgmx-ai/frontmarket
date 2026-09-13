const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

const webhookSearch = `          console.log(\`[MisticPay Webhook] Sucesso! Pedido \${orderId} pago, D+3 agendado: \${creditResult.releaseAt}\`);
          return res.status(200).json({`;

const webhookReplace = `          console.log(\`[MisticPay Webhook] Sucesso! Pedido \${orderId} pago, D+3 agendado: \${creditResult.releaseAt}\`);

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

          return res.status(200).json({`;

if (code.includes(webhookSearch)) {
  code = code.replace(webhookSearch, webhookReplace);
}

fs.writeFileSync('server-misticpay.ts', code);
