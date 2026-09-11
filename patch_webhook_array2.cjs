const fs = require('fs');
let content = fs.readFileSync('server-misticpay.ts', 'utf-8');

const regex = /const unwrapped =.*?const rawEventName = .*?;/s;
const newCode = `
    const rawObj = Array.isArray(parsedPayload) ? parsedPayload[0] : parsedPayload;
    const unwrapped = rawObj?.data || rawObj?.transaction || rawObj || {};
    
    const transactionId = unwrapped.transactionId || rawObj.transactionId;
    const status = unwrapped.status || unwrapped.transactionState || rawObj.status || rawObj.transactionState;
    const value = unwrapped.value || unwrapped.amount || rawObj.value || rawObj.amount;
    const transactionType = unwrapped.transactionType || rawObj.transactionType || rawObj.event;
    const e2e = unwrapped.e2e || unwrapped.e2eId || rawObj.e2e || rawObj.e2eId;
    const rawEventName = rawObj.event || rawObj.eventType || unwrapped.event || unwrapped.eventType;
`;

content = content.replace(regex, newCode.trim());
fs.writeFileSync('server-misticpay.ts', content);
