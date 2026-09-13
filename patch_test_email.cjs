const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const search = `      if (result.success) {
        res.json({ success: true, provider: 'resend', messageId: result.data?.id });
      } else {
        res.json({ success: false, provider: 'resend', code: result.error });
      }`;

const replace = `      if (result.success) {
        res.json({ success: true, provider: 'resend', messageId: result.providerMessageId });
      } else {
        res.status(500).json({ success: false, provider: 'resend', code: result.error });
      }`;

code = code.replace(search, replace);
fs.writeFileSync('server.ts', code);
