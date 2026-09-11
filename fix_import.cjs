const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

if (!code.includes('import { triggerOrderStatusEmail }')) {
  code = code.replace(
    "import express from 'express';",
    "import express from 'express';\nimport { triggerOrderStatusEmail } from './server-email-triggers.js';"
  );
}

fs.writeFileSync('server-misticpay.ts', code);
