const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const \{ getAuth \} = require\('firebase-admin\/auth'\);/g, "const { getAuth } = await import('firebase-admin/auth');");

fs.writeFileSync('server.ts', code);
