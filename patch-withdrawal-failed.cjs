const fs = require('fs');
let code = fs.readFileSync('server-financial-service.ts', 'utf8');

const search = `        createdAt: FieldValue.serverTimestamp()
      };
      t.set(newLedgerDoc, ledgerEntry);
    });
  }`;

const replace = `        createdAt: FieldValue.serverTimestamp()
      };
      t.set(newLedgerDoc, ledgerEntry);
    });

    import('./server-notification-service.js').then(({ processEvent }) => {
      processEvent({
        eventId: \`WD_FAILED_\${params.withdrawalId}\`,
        type: 'WITHDRAWAL_FAILED',
        storeId: params.storeId,
        withdrawalId: params.withdrawalId,
        source: 'system',
        occurredAt: new Date().toISOString()
      }).catch(console.error);
    });
  }`;

if (code.includes(search)) {
  code = code.replace(search, replace);
}

fs.writeFileSync('server-financial-service.ts', code);
