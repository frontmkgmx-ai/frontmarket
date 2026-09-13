const fs = require('fs');
let code = fs.readFileSync('server-notification-service.ts', 'utf8');

if (!code.includes("'SALE_CREATED'")) {
  code = code.replace(
    "| 'ORDER_PAYMENT_PENDING'",
    "| 'ORDER_PAYMENT_PENDING'\n  | 'SALE_CREATED'"
  );
}

const switchSearch = `  switch (event.type) {
    case 'ORDER_PAYMENT_CONFIRMED':
      title = 'Pagamento Confirmado';
      message = \`O pagamento do pedido #\${event.orderId?.slice(-6).toUpperCase()} foi confirmado.\`;
      type = 'success';
      break;`;

const switchReplace = `  switch (event.type) {
    case 'SALE_CREATED':
      title = 'Nova venda';
      message = \`Você realizou uma nova venda no pedido #\${event.orderId?.slice(-6).toUpperCase()}.\`;
      type = 'success';
      break;
    case 'ORDER_PAYMENT_CONFIRMED':
      title = 'Pagamento Confirmado';
      message = \`O pagamento do pedido #\${event.orderId?.slice(-6).toUpperCase()} foi confirmado.\`;
      type = 'success';
      break;`;

if (!code.includes("case 'SALE_CREATED':")) {
  code = code.replace(switchSearch, switchReplace);
}

// Ensure WITHDRAWAL_FAILED and WITHDRAWAL_CREATED have notifications
const withdrawalSearch = `    case 'WITHDRAWAL_COMPLETED':
      title = 'Saque Concluído';
      message = \`Seu saque foi processado com sucesso.\`;
      type = 'success';
      break;`;

const withdrawalReplace = `    case 'WITHDRAWAL_CREATED':
      title = 'Saque Solicitado';
      message = \`Seu saque foi solicitado e está em processamento.\`;
      type = 'info';
      break;
    case 'WITHDRAWAL_FAILED':
      title = 'Saque Falhou';
      message = \`Seu saque não foi concluído.\`;
      type = 'error';
      break;
    case 'WITHDRAWAL_COMPLETED':
      title = 'Saque Concluído';
      message = \`Seu saque foi processado com sucesso.\`;
      type = 'success';
      break;`;

if (!code.includes("case 'WITHDRAWAL_CREATED':")) {
  code = code.replace(withdrawalSearch, withdrawalReplace);
}

const statusSearch = `    case 'ORDER_REFUNDED':
      title = 'Reembolso Solicitado';
      message = \`O pedido #\${event.orderId?.slice(-6).toUpperCase()} foi reembolsado.\`;
      type = 'success';
      break;`;

const statusReplace = `    case 'ORDER_STATUS_CHANGED':
      title = 'Status do Pedido Atualizado';
      message = \`O pedido #\${event.orderId?.slice(-6).toUpperCase()} mudou de status.\`;
      type = 'info';
      break;
    case 'ORDER_REFUNDED':
      title = 'Reembolso Solicitado';
      message = \`O pedido #\${event.orderId?.slice(-6).toUpperCase()} foi reembolsado.\`;
      type = 'success';
      break;`;

if (!code.includes("case 'ORDER_STATUS_CHANGED':")) {
  code = code.replace(statusSearch, statusReplace);
}

fs.writeFileSync('server-notification-service.ts', code);
