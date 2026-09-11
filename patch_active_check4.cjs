const fs = require('fs');
let content = fs.readFileSync('server-misticpay.ts', 'utf-8');

const regex = /if \(activeCheck\.status !== 'SUCCESS'\) {/g;
const newCode = `
          if (activeCheck.status === 'PENDING') {
            console.warn(\`[MisticPay Webhook] Race condition no gateway detectada: API retornou PENDENTE, mas Webhook diz COMPLETO. Solicitando retry.\`);
            return res.status(409).json({
              error: 'Transação ainda consta como pendente na API. Tente novamente em breve.',
              code: 'ACTIVE_CHECK_PENDING_RETRY'
            });
          }

          if (activeCheck.status !== 'SUCCESS') {
`;

content = content.replace(regex, newCode.trim());
fs.writeFileSync('server-misticpay.ts', content);
