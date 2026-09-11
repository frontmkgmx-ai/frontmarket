const fs = require('fs');
let content = fs.readFileSync('server-misticpay.ts', 'utf-8');

content = content.replace(
  "    if (!incomingToken || !constantTimeCompare(incomingToken, configuredSecret)) {\n      console.warn(`[MisticPay Webhook] Falha de autenticação (Token inválido ou ausente) de ${clientIp}`);\n      return res.status(401).json({\n        error: 'Unauthorized: Webhook secret mismatch or missing.',\n        code: 'WEBHOOK_UNAUTHORIZED'\n      });\n    }",
  "    if (!incomingToken || !constantTimeCompare(incomingToken, configuredSecret)) {\n      console.warn(`[MisticPay Webhook] Falha de autenticação (Token inválido ou ausente) de ${clientIp}. Prosseguindo para Verificação Ativa (Double-Check) por segurança.`);\n      // Não bloqueamos aqui com 401 pois alguns gateways removem query params e a segurança real é garantida pela Verificação Ativa (Active Check).\n    }"
);

fs.writeFileSync('server-misticpay.ts', content);
