const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

const search = `        if (normStatus === 'COMPLETO' || normStatus === 'SUCESSO' || normStatus === 'PAID' || normStatus === 'COMPLETED') {
          // Validação de transição de estado
          if (!canTransitionState('withdrawal', wData.status || 'processing', 'completed')) {
            console.error(\`[MisticPay Webhook] Transição de saque inválida: de '\${wData.status}' para 'completed'.\`);
            return res.status(409).json({ error: 'Transição de saque inválida.' });
          }

          const claim = await WebhookService.claimEvent(db, {
            provider: 'misticpay',
            eventId,
            eventType: 'RETIRADA',
            payloadHash,
            entityId: withdrawalId,
            tenantId: storeId
          });

          if (claim.alreadyProcessed) {
            return res.status(200).json({ status: 'already_processed', eventId });
          }`;

const replace = `        if (normStatus === 'COMPLETO' || normStatus === 'SUCESSO' || normStatus === 'PAID' || normStatus === 'COMPLETED') {
          // Validação de transição de estado
          if (!canTransitionState('withdrawal', wData.status || 'processing', 'completed')) {
            console.error(\`[MisticPay Webhook] Transição de saque inválida: de '\${wData.status}' para 'completed'.\`);
            return res.status(409).json({ error: 'Transição de saque inválida.' });
          }

          // Consulta Autoritativa MisticPay API antes de confirmar o webhook financeiro
          const activeCheck = await checkTransactionWithMistic(String(transactionId));
          if (activeCheck.status !== 'SUCCESS' || activeCheck.state !== 'COMPLETO') {
             console.error(\`[MisticPay Webhook] Falha na verificação autoritativa do saque \${withdrawalId}: Estado: \${activeCheck.state}\`);
             return res.status(422).json({ error: 'MisticPay API não confirma transação como COMPLETO.' });
          }

          const claim = await WebhookService.claimEvent(db, {
            provider: 'misticpay',
            eventId,
            eventType: 'RETIRADA',
            payloadHash,
            entityId: withdrawalId,
            tenantId: storeId
          });

          if (claim.alreadyProcessed) {
            return res.status(200).json({ status: 'already_processed', eventId });
          }`;

if (code.includes(search)) {
  code = code.replace(search, replace);
}

fs.writeFileSync('server-misticpay.ts', code);
