# Projeto FrontMK

### Configuração de E-mails (Resend)
Para habilitar o envio de e-mails transacionais (como recibos de pagamento) e a recepção segura de webhooks, configure as seguintes variáveis no seu ambiente de produção (por exemplo, na Cloudflare usando \`wrangler secret put\` ou no painel da sua provedora):

- \`RESEND_API_KEY\`: Chave da API obtida no painel do Resend.
- \`RESEND_WEBHOOK_SECRET\`: Chave para assinar/validar webhooks (padrão Svix), obtida ao criar o webhook no painel do Resend.

**Atenção:** Nunca versione os valores reais dessas variáveis em arquivos como \`.env\`.
