const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "setupCustomerAuthRoutes(app, getFirestore);",
  "setupCustomerAuthRoutes(app, getFirestore);\n  setupResendRoutes(app);"
);
fs.writeFileSync('server.ts', code);
