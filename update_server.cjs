const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const importLines = `
import { setupMercadoPagoRoutes } from './server-mercadopago.js';
import { setupStripeRoutes } from './server-stripe.js';
import { setupPagBankRoutes } from './server-pagbank.js';
import { setupInfinitePayRoutes } from './server-infinitepay.js';
`;

// insert after import { setupInvictusPayRoutes }
code = code.replace("import { setupInvictusPayRoutes } from './server-invictuspay.js';", "import { setupInvictusPayRoutes } from './server-invictuspay.js';" + importLines);

const setupLines = `
  setupMercadoPagoRoutes(app, authMiddleware, getFirestore);
  setupStripeRoutes(app, authMiddleware, getFirestore);
  setupPagBankRoutes(app, authMiddleware, getFirestore);
  setupInfinitePayRoutes(app, authMiddleware, getFirestore);
`;

code = code.replace("setupInvictusPayRoutes(app, authMiddleware, getFirestore);", "setupInvictusPayRoutes(app, authMiddleware, getFirestore);" + setupLines);

fs.writeFileSync('server.ts', code);
