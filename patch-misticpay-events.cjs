const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

const paidSearch = `        processEvent({
          eventId: 'PAID_' + orderId,
          type: 'ORDER_PAYMENT_CONFIRMED',
          storeId,
          orderId,
          source: 'misticpay',
          occurredAt: new Date().toISOString()
        }).catch(console.error);
        return res.json({ status: 'paid' });`;

const paidReplace = `        Promise.all([
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
        return res.json({ status: 'paid' });`;

if (code.includes(paidSearch)) {
  code = code.replace(paidSearch, paidReplace);
}

// Similarly for webhook paid handling
const webhookPaidSearch = `        processEvent({
          eventId: 'PAID_' + orderId,
          type: 'ORDER_PAYMENT_CONFIRMED',
          storeId,
          orderId,
          source: 'misticpay',
          occurredAt: new Date().toISOString()
        }).catch(console.error);
        return res.status(200).json({ status: 'paid', eventId });`;

const webhookPaidReplace = `        Promise.all([
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
        return res.status(200).json({ status: 'paid', eventId });`;

if (code.includes(webhookPaidSearch)) {
  code = code.replace(webhookPaidSearch, webhookPaidReplace);
}

fs.writeFileSync('server-misticpay.ts', code);
