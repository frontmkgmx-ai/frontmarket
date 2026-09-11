const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes('setupResendRoutes')) {
  code = code.replace(
    "import { setupCustomerAuthRoutes } from './server-customer-auth.js';",
    "import { setupCustomerAuthRoutes } from './server-customer-auth.js';\nimport { setupResendRoutes } from './server-resend.js';"
  );
  
  code = code.replace(
    "setupCustomerAuthRoutes(app);",
    "setupCustomerAuthRoutes(app);\n  setupResendRoutes(app);"
  );
  
  fs.writeFileSync('server.ts', code);
}
