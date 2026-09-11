const fs = require('fs');
let content = fs.readFileSync('server-misticpay.ts', 'utf-8');

const regex = /} else if \(\s*state === 'FALHA' \|\|/g;
content = content.replace(regex, "} else if (state === 'PENDENTE' || state === 'PENDING' || state === 'WAITING' || state === 'AGUARDANDO') {\n        return { status: 'PENDING', state, data };\n      } else if (\\n        state === 'FALHA' ||".replace(/\\n/g, '\n'));

fs.writeFileSync('server-misticpay.ts', content);
