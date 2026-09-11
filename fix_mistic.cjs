const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

code = code.replace(
  "const FinancialWalletService = require('./server-financial-service').FinancialWalletService;",
  "const { FinancialWalletService } = await import('./server-financial-service.ts');"
);

code = code.replace(
  "const FinancialWalletService = require('./server-financial-service').FinancialWalletService;",
  "const { FinancialWalletService } = await import('./server-financial-service.ts');"
);

fs.writeFileSync('server-misticpay.ts', code);
