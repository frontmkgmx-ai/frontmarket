const fs = require('fs');
let content = fs.readFileSync('server-misticpay.ts', 'utf-8');

content = content.replace(
  "        const host = req.get('host');\n        if (host && host.includes('run.app')) {\n          baseUrl = `https://${host}`;\n        } else {\n          baseUrl = 'https://marketplace.frontmk.online';\n        }",
  "        const host = req.get('x-forwarded-host') || req.get('host');\n        if (host) {\n          baseUrl = `https://${host}`;\n        } else {\n          baseUrl = 'https://marketplace.frontmk.online';\n        }"
);

fs.writeFileSync('server-misticpay.ts', content);
