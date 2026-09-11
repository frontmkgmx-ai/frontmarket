const fs = require('fs');
let content = fs.readFileSync('server-financial-service.ts', 'utf-8');

content = content.replace(
  "    gateway: 'misticpay'",
  "    gateway: 'misticpay';\n    requestHost?: string;"
);

content = content.replace(
  "      const baseAppUrl = (process.env.APP_URL || 'https://marketplace.frontmk.online').replace(/\\/+$/, '');",
  "      const host = params.requestHost || process.env.APP_URL || 'marketplace.frontmk.online';\n      const baseAppUrl = host.startsWith('http') ? host.replace(/\\/+$/, '') : `https://${host.replace(/\\/+$/, '')}`;"
);

fs.writeFileSync('server-financial-service.ts', content);
