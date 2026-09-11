const fs = require('fs');
let content = fs.readFileSync('server-wallet.ts', 'utf-8');

content = content.replace(
  "          gateway: 'misticpay',\n          requestId\n        },",
  "          gateway: 'misticpay',\n          requestId,\n          requestHost: req.get('x-forwarded-host') || req.get('host')\n        },"
);

fs.writeFileSync('server-wallet.ts', content);
