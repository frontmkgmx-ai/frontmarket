const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

code = code.replace(/const \{ getAuth \} = require\('firebase-admin\/auth'\);/g, "const { getAuth } = await import('firebase-admin/auth');");

fs.writeFileSync('server-misticpay.ts', code);
