const fs = require('fs');
let code = fs.readFileSync('server-financial-service.ts', 'utf8');

const search = `return {
        success: true,
        alreadyReleased: false,
        netAmountCents: releaseData.netAmountCents
      };
    });`;

const replace = `return {
        success: true,
        alreadyReleased: false,
        netAmountCents: releaseData.netAmountCents
      };
    });

    if (result && result.success && !result.alreadyReleased) {
      import('./server-notification-service.js').then(({ processEvent }) => {
        processEvent({
          eventId: \`D3_\${storeId}_\${orderId}\`,
          type: 'PAYMENT_RELEASED_D3',
          storeId,
          orderId,
          source: 'system',
          occurredAt: new Date().toISOString()
        }).catch(console.error);
      });
    }

    return result;`;

code = code.replace(search, replace);

fs.writeFileSync('server-financial-service.ts', code);
