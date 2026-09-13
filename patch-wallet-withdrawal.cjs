const fs = require('fs');
let code = fs.readFileSync('server-wallet.ts', 'utf8');

const search = `      if (!result.success) {
        const statusCode =`;

const replace = `      if (result.success) {
        import('./server-notification-service.js').then(({ processEvent }) => {
          processEvent({
            eventId: 'WD_CREATED_' + result.withdrawalId,
            type: 'WITHDRAWAL_CREATED',
            storeId,
            withdrawalId: result.withdrawalId,
            source: 'wallet',
            occurredAt: new Date().toISOString()
          }).catch(console.error);
        });
      }
      
      if (!result.success) {
        const statusCode =`;

if (code.includes(search)) {
  code = code.replace(search, replace);
}

fs.writeFileSync('server-wallet.ts', code);
