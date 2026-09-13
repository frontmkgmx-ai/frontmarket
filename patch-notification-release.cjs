const fs = require('fs');
let code = fs.readFileSync('server-financial-service.ts', 'utf8');

const releaseEndSearch = `      return {
        success: true,
        releaseId,
        netAmountCents
      };
    });
  }`;

const releaseEndReplace = `      return {
        success: true,
        releaseId,
        netAmountCents
      };
    });

    if (result && result.success) {
      import('./server-notification-service.js').then(({ processEvent }) => {
        processEvent({
          eventId: \`D3_RELEASED_\${params.releaseId}\`,
          type: 'PAYMENT_RELEASED_D3',
          storeId: params.storeId,
          source: 'system',
          occurredAt: new Date().toISOString()
        }).catch(console.error);
      });
    }

    return result;
  }`;

if (code.includes(releaseEndSearch)) {
  code = code.replace(releaseEndSearch, releaseEndReplace);
}

fs.writeFileSync('server-financial-service.ts', code);
