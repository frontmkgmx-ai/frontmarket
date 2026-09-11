const fs = require('fs');
let content = fs.readFileSync('server-misticpay.ts', 'utf-8');

content = content.replace(
  "const isPaymentComplete = status === 'COMPLETO' || status === 'PAID';",
  "const isPaymentComplete = status === 'COMPLETO' || status === 'PAID' || status === 'COMPLETED' || status === 'SUCESSO' || String(status).toUpperCase() === 'COMPLETO';"
);

fs.writeFileSync('server-misticpay.ts', content);
