const fs = require('fs');
let content = fs.readFileSync('server-misticpay.ts', 'utf-8');

content = content.replace(
  "      } else if (\\n        state === 'FALHA' ||",
  "      } else if (state === 'PENDENTE' || state === 'PENDING' || state === 'WAITING' || state === 'AGUARDANDO') {\n        // Gateway eventulamente consistente (ainda não atualizou a leitura)\n        return { status: 'PENDING', state, data };\n      } else if (\\n        state === 'FALHA' ||"
);

fs.writeFileSync('server-misticpay.ts', content);
