const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

const search = `    if (!incomingToken || !constantTimeCompare(incomingToken, configuredSecret)) {
      console.warn(\`[MisticPay Webhook] Falha de autenticação (Token inválido ou ausente) de \${clientIp}. Prosseguindo para Verificação Ativa (Double-Check) por segurança.\`);
      // Não bloqueamos aqui com 401 pois alguns gateways removem query params e a segurança real é garantida pela Verificação Ativa (Active Check).`;

const replace = `    if (!incomingToken || !constantTimeCompare(incomingToken, configuredSecret)) {
      console.warn(\`[MisticPay Webhook] Falha de autenticação (Token inválido ou ausente) de \${clientIp}. Abortando processamento (Fail-Closed).\`);
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing webhook token.' });`;

if (code.includes(search)) {
  code = code.replace(search, replace);
}

fs.writeFileSync('server-misticpay.ts', code);
