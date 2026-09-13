const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/res\.status\(500\)\.json\(\{ success: false, provider: 'resend', code: result\.error \}\);/g, "res.status(500).json({ error: result.error });");

fs.writeFileSync('server.ts', code);
