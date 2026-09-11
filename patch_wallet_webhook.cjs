const fs = require('fs');
let content = fs.readFileSync('server-financial-service.ts', 'utf-8');

content = content.replace(
  "      const baseAppUrl = (process.env.APP_URL || 'https://marketplace.frontmk.online').replace(/\\/+$/, '');",
  "      // The host is injected into APP_URL during runtime in server-wallet if not set, or we default it\n      const baseAppUrl = (process.env.APP_URL || 'https://marketplace.frontmk.online').replace(/\\/+$/, '');"
);

fs.writeFileSync('server-financial-service.ts', content);
