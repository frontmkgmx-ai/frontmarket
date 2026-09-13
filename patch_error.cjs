const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/res\.status\(500\)\.json\(\{ error: 'Internal server error' \}\);/g, "res.status(500).json({ error: 'Internal server error', details: err.message, stack: err.stack });");

fs.writeFileSync('server.ts', code);
