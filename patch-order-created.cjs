const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

const orderCreateSearch = `await orderRef.set(newOrder);`;
const orderCreateReplace = `await orderRef.set(newOrder);

      import('./server-notification-service.js').then(({ processEvent }) => {
        processEvent({
          eventId: 'CREATED_' + orderId,
          type: 'ORDER_CREATED',
          storeId,
          orderId,
          source: 'checkout',
          occurredAt: new Date().toISOString()
        }).catch(console.error);
      });`;

code = code.replace(orderCreateSearch, orderCreateReplace);

fs.writeFileSync('server-misticpay.ts', code);
