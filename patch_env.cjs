const fs = require('fs');
let code = fs.readFileSync('.env.example', 'utf8');

if (!code.includes('RESEND_API_KEY')) {
  code += `

# [RESEND - EMAIL TRANSACTIONS]
# Configurações do Resend para envio de emails e validação de webhooks.
# IMPORTANTE: No ambiente de produção (Cloudflare, etc), configure essas variáveis 
# de forma segura (ex: wrangler secret put RESEND_API_KEY). Nunca exponha esses valores.
RESEND_API_KEY=sua_chave_api_resend_aqui
RESEND_WEBHOOK_SECRET=seu_segredo_webhook_resend_aqui
`;
  fs.writeFileSync('.env.example', code);
}
