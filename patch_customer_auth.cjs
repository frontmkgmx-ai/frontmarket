const fs = require('fs');
let content = fs.readFileSync('server-customer-auth.ts', 'utf-8');

content = content.replace(
  "createdAt: new Date().toISOString(),\n        serverCreatedAt: FieldValue.serverTimestamp()",
  "createdAt: FieldValue.serverTimestamp(),\n        registeredAtIso: new Date().toISOString()"
);

fs.writeFileSync('server-customer-auth.ts', content);
