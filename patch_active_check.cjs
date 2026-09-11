const fs = require('fs');
let content = fs.readFileSync('server-misticpay.ts', 'utf-8');

content = content.replace(
  "        headers: {\n          'Authorization': authHeader,\n          'Content-Type': 'application/json'\n        },",
  "        headers: {\n          'Authorization': authHeader,\n          'ci': process.env.MISTIC_PAY_CLIENT_ID || '',\n          'cs': process.env.MISTIC_PAY_CLIENT_SECRET || '',\n          'Content-Type': 'application/json'\n        },"
);

fs.writeFileSync('server-misticpay.ts', content);
