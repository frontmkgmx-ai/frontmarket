const fs = require('fs');
let code = fs.readFileSync('server-financial-service.ts', 'utf8');

const search = `t.update(withdrawalRef, {
        status: 'completed',
        misticTransactionId: misticTransactionId || wData.misticTransactionId || null,
        updatedAt: FieldValue.serverTimestamp()
      });`;

const replace = `t.update(withdrawalRef, {
        status: 'completed',
        misticTransactionId: misticTransactionId || wData.misticTransactionId || null,
        updatedAt: FieldValue.serverTimestamp()
      });

      import('./server-notification-service.js').then(({ processEvent }) => {
        processEvent({
          eventId: \`WITHDRAWAL_COMPLETED_\${withdrawalId}\`,
          type: 'WITHDRAWAL_COMPLETED',
          storeId,
          withdrawalId,
          source: 'system',
          occurredAt: new Date().toISOString()
        }).catch(console.error);
      });`;

code = code.replace(search, replace);

fs.writeFileSync('server-financial-service.ts', code);
