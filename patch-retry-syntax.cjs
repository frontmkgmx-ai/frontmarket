const fs = require('fs');
let code = fs.readFileSync('server-email-retry.ts', 'utf8');

code = code.replace(
  "console.log(\`[Email Retry] Retentando envio \${doc.id} (Tentativa \${retryCount + 1})\`);",
  "console.log(`[Email Retry] Retentando envio ${doc.id} (Tentativa ${retryCount + 1})`);"
);

fs.writeFileSync('server-email-retry.ts', code);
