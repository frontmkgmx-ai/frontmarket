const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const search = `      const { status } = req.body;
      const { triggerOrderStatusEmail } = await import('./server-email-triggers.js');
      await triggerOrderStatusEmail(storeId, orderId, status);
      res.json({ success: true });`;

const replace = `      const { status } = req.body;
      const { triggerOrderStatusEmail } = await import('./server-email-triggers.js');
      const { processEvent } = await import('./server-notification-service.js');
      
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
      ]).catch(console.error);

      res.json({ success: true });`;

if (code.includes(search)) {
  code = code.replace(search, replace);
}

fs.writeFileSync('server.ts', code);
