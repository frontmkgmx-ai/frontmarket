const fs = require('fs');
let code = fs.readFileSync('server-email.ts', 'utf8');

code = code.replace(
  /return \{ success: true, mocked: true \};/g,
  "return { success: false, error: 'RESEND_API_KEY not configured' };"
);

fs.writeFileSync('server-email.ts', code);
