const fs = require('fs');
let code = fs.readFileSync('server-email-retry.ts', 'utf8');

code = code.replace(/emailRes\.data\?\.id/g, 'emailRes.providerMessageId');

fs.writeFileSync('server-email-retry.ts', code);
