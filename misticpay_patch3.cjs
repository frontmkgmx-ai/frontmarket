const fs = require('fs');
let content = fs.readFileSync('server-misticpay.ts', 'utf-8');

content = content.replace(
  "      if (eventType === 'DEPOSITO' || transactionType === 'DEPOSITO') {",
  "      const isDepositEvent = eventType === 'DEPOSITO' || transactionType === 'DEPOSITO' || eventType === 'RECEBIMENTO' || eventType === 'UNKNOWN' || eventType === 'PAYMENT';\n      if (isDepositEvent) {"
);

fs.writeFileSync('server-misticpay.ts', content);
