const fs = require('fs');
let code = fs.readFileSync('server-notification-service.ts', 'utf8');

if (!code.includes("'D3_RELEASE_CREATED'")) {
  code = code.replace(
    "| 'PAYMENT_RELEASED_D3'",
    "| 'PAYMENT_RELEASED_D3'\n  | 'D3_RELEASE_CREATED'\n  | 'D3_BALANCE_RELEASED'"
  );
}

const d3Search = `    case 'PAYMENT_RELEASED_D3':
      title = 'Pagamento Liberado (D+3)';
      message = \`Um pagamento foi liberado para saque.\`;
      type = 'success';
      break;`;

const d3Replace = `    case 'PAYMENT_RELEASED_D3':
    case 'D3_BALANCE_RELEASED':
      title = 'Pagamento Liberado (D+3)';
      message = \`Um pagamento foi liberado para saque.\`;
      type = 'success';
      break;
    case 'D3_RELEASE_CREATED':
      title = 'Pagamento em Processamento';
      message = \`Um pagamento foi confirmado e será liberado em 3 dias úteis.\`;
      type = 'info';
      break;`;

if (!code.includes("case 'D3_RELEASE_CREATED':")) {
  code = code.replace(d3Search, d3Replace);
}

fs.writeFileSync('server-notification-service.ts', code);
