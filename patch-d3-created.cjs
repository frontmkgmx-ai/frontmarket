const fs = require('fs');
let code = fs.readFileSync('server-financial-service.ts', 'utf8');

const search = `      return {
        success: true,
        netAmountCents,
        releaseAt: releaseAtTs.toDate().toISOString()
      };
    });`;

const replace = `      return {
        success: true,
        netAmountCents,
        releaseAt: releaseAtTs.toDate().toISOString()
      };
    });

    if (result && result.success) {
      import('./server-notification-service.js').then(({ processEvent }) => {
        processEvent({
          eventId: \`D3_CREATED_\${storeId}_\${orderId}\`,
          type: 'ORDER_PAYMENT_PENDING' as any, // D3_RELEASE_CREATED equivalent?
          storeId,
          orderId,
          source: 'system',
          occurredAt: new Date().toISOString()
        }).catch(console.error);
      });
    }

    return result;`;

if (code.includes(search)) {
  code = code.replace(search, replace);
}

fs.writeFileSync('server-financial-service.ts', code);
