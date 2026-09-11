const fs = require('fs');
let content = fs.readFileSync('server-misticpay.ts', 'utf-8');

const replacement = `
    const unwrapped = parsedPayload.data || parsedPayload.transaction || parsedPayload;
    
    const transactionId = unwrapped.transactionId || parsedPayload.transactionId;
    const status = unwrapped.status || unwrapped.transactionState || parsedPayload.status || parsedPayload.transactionState;
    const value = unwrapped.value || unwrapped.amount || parsedPayload.value || parsedPayload.amount;
    const transactionType = unwrapped.transactionType || parsedPayload.transactionType || parsedPayload.event;
    const e2e = unwrapped.e2e || unwrapped.e2eId || parsedPayload.e2e || parsedPayload.e2eId;
    const rawEventName = parsedPayload.event || parsedPayload.eventType || unwrapped.event || unwrapped.eventType;

    console.log('[MisticPay Webhook] Raw Payload debug:', JSON.stringify(parsedPayload).substring(0, 500));
`;

content = content.replace(
  "    const {\n      transactionId,\n      status,\n      value,\n      transactionType,\n      e2e,\n      event: rawEventName\n    } = parsedPayload;",
  replacement
);

fs.writeFileSync('server-misticpay.ts', content);
