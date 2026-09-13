const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const search = `      await Promise.all([
        triggerOrderStatusEmail(storeId, orderId, status),
        processEvent({
          eventId: 'STATUS_' + orderId + '_' + status,
          type: 'ORDER_STATUS_CHANGED',
          storeId,
          orderId,
          source: 'admin_panel',
          occurredAt: new Date().toISOString()
        })
      ]).catch(console.error);

      res.json({ success: true });`;

const replace = `      // Run and await
      await Promise.all([
        triggerOrderStatusEmail(storeId, orderId, status),
        processEvent({
          eventId: 'STATUS_' + orderId + '_' + status,
          type: 'ORDER_STATUS_CHANGED',
          storeId,
          orderId,
          source: 'admin_panel',
          occurredAt: new Date().toISOString()
        })
      ]);

      res.json({ success: true });`;

code = code.replace(search, replace);
fs.writeFileSync('server.ts', code);
