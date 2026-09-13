const fs = require('fs');
let code = fs.readFileSync('server-email-triggers.ts', 'utf8');

code = code.replace(/eventId,/g, 'eventId: eventId || null,');

fs.writeFileSync('server-email-triggers.ts', code);
