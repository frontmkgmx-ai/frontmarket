const fs = require('fs');
let content = fs.readFileSync('server-misticpay.ts', 'utf-8');

content = content.replace(
  "      let baseUrl = (process.env.APP_URL || '').trim();\n      if (!baseUrl) {\n        baseUrl = 'https://marketplace.frontmk.online';\n      } else if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {\n        baseUrl = `https://${baseUrl}`;\n      }",
  "      let baseUrl = (process.env.APP_URL || '').trim();\n      if (!baseUrl) {\n        const host = req.get('host');\n        if (host && host.includes('run.app')) {\n          baseUrl = `https://${host}`;\n        } else {\n          baseUrl = 'https://marketplace.frontmk.online';\n        }\n      } else if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {\n        baseUrl = `https://${baseUrl}`;\n      }"
);

fs.writeFileSync('server-misticpay.ts', content);
