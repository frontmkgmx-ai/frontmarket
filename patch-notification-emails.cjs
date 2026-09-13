const fs = require('fs');
let code = fs.readFileSync('server-notification-service.ts', 'utf8');

const search = `async function handleEmails(db: any, event: BaseEvent) {
  if (!event.storeId) return;

  if (event.type === 'ORDER_PAYMENT_CONFIRMED' || event.type === 'ORDER_REFUNDED' || event.type === 'ORDER_CANCELLED') {
    // This is basically triggerOrderStatusEmail but inside the centralized event handler
    const statusMap: any = {
      'ORDER_PAYMENT_CONFIRMED': 'paid',
      'ORDER_REFUNDED': 'refunded',
      'ORDER_CANCELLED': 'canceled'
    };
    const newStatus = statusMap[event.type];
    const { triggerOrderStatusEmail } = await import('./server-email-triggers.js');
    await triggerOrderStatusEmail(event.storeId, event.orderId!, newStatus);
  }
}`;

const replace = `async function handleEmails(db: any, event: BaseEvent) {
  if (!event.storeId) return;

  // Envio de emails para os clientes (checkout status)
  if (event.type === 'ORDER_PAYMENT_CONFIRMED' || event.type === 'ORDER_REFUNDED' || event.type === 'ORDER_CANCELLED') {
    const statusMap: any = {
      'ORDER_PAYMENT_CONFIRMED': 'paid',
      'ORDER_REFUNDED': 'refunded',
      'ORDER_CANCELLED': 'canceled'
    };
    const newStatus = statusMap[event.type];
    const { triggerOrderStatusEmail } = await import('./server-email-triggers.js');
    await triggerOrderStatusEmail(event.storeId, event.orderId!, newStatus);
  }

  // Envio de emails de sistema para os donos da loja (vendedor)
  try {
    const { sendEmail } = await import('./server-email.js');
    const usersSnap = await db.collection('users').where('stores', 'array-contains', event.storeId).get();
    if (usersSnap.empty) return;
    
    for (const doc of usersSnap.docs) {
      const user = doc.data();
      const sellerEmail = user.email;
      if (!sellerEmail) continue;

      let subject = '';
      let html = '';

      switch (event.type) {
        case 'SALE_CREATED':
          subject = 'Nova Venda Realizada!';
          html = \`<p>Parabéns! Você realizou uma nova venda no pedido #\${event.orderId?.slice(-6).toUpperCase()}.</p>\`;
          break;
        case 'WITHDRAWAL_CREATED':
          subject = 'Saque Solicitado';
          html = \`<p>Recebemos sua solicitação de saque e ela já está em processamento.</p>\`;
          break;
        case 'WITHDRAWAL_COMPLETED':
          subject = 'Saque Concluído com Sucesso';
          html = \`<p>A transferência referente ao seu saque foi concluída para sua conta bancária via PIX.</p>\`;
          break;
        case 'WITHDRAWAL_FAILED':
          subject = 'Falha no Saque';
          html = \`<p>Ocorreu um problema ao processar seu saque. O valor retornou para sua carteira.</p>\`;
          break;
        case 'D3_RELEASE_CREATED':
          subject = 'Pagamento em D+3 Confirmado';
          html = \`<p>Um pagamento foi confirmado e seu valor correspondente foi provisionado para liberação na sua carteira em 3 dias úteis.</p>\`;
          break;
        case 'PAYMENT_RELEASED_D3':
        case 'D3_BALANCE_RELEASED':
          subject = 'Saldo Liberado!';
          html = \`<p>O período de retenção D+3 de uma de suas vendas foi concluído e o valor agora está disponível para saque na sua carteira.</p>\`;
          break;
        case 'KYC_APPROVED':
          subject = 'Documentação Aprovada';
          html = \`<p>Sua verificação de identidade foi aprovada com sucesso! Seus saques já estão liberados.</p>\`;
          break;
        case 'KYC_DECLINED':
          subject = 'Pendência na sua Verificação de Identidade';
          html = \`<p>Houve um problema com sua verificação de identidade. Por favor, acesse o painel para reenviar seus documentos.</p>\`;
          break;
        default:
          continue; // Pula se não houver template configurado
      }

      if (subject && html) {
        const emailRes = await sendEmail({
          to: sellerEmail,
          subject,
          html: \`<div style="font-family: sans-serif; color: #333; line-height: 1.5;">\${html}</div>\`,
          text: html.replace(/<[^>]*>?/gm, '') // Strip HTML for plain text
        });
        
        await db.collection('email_deliveries').add({
          storeId: event.storeId,
          orderId: event.orderId || null,
          to: sellerEmail,
          subject,
          status: emailRes.success ? 'sent' : 'failed',
          provider: 'resend',
          providerMessageId: emailRes.data?.id || null,
          lastErrorCode: emailRes.error ? (typeof emailRes.error === 'string' ? emailRes.error : emailRes.error.name) : null,
          lastErrorMessage: emailRes.error ? (typeof emailRes.error === 'string' ? emailRes.error : emailRes.error.message) : null,
          createdAt: require('firebase-admin/firestore').FieldValue.serverTimestamp(),
          sentAt: emailRes.success ? require('firebase-admin/firestore').FieldValue.serverTimestamp() : null
        });
      }
    }
  } catch (err) {
    console.error('[Notification Service] Erro ao disparar e-mails de sistema:', err);
  }
}`;

if (code.includes(search)) {
  code = code.replace(search, replace);
}

fs.writeFileSync('server-notification-service.ts', code);
