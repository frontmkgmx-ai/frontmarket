const fs = require('fs');
let content = fs.readFileSync('server-misticpay.ts', 'utf-8');

content = content.replace(
  "const unwrapped = parsedPayload.data || parsedPayload.transaction || parsedPayload;",
  "const rawObj = Array.isArray(parsedPayload) ? parsedPayload[0] : parsedPayload;\n    const unwrapped = rawObj.data || rawObj.transaction || rawObj;"
);
content = content.replace(
  "parsedPayload.transactionId",
  "rawObj.transactionId"
);
content = content.replace(
  "parsedPayload.status",
  "rawObj.status"
);
content = content.replace(
  "parsedPayload.status",
  "rawObj.status"
);
content = content.replace(
  "parsedPayload.value",
  "rawObj.value"
);
content = content.replace(
  "parsedPayload.amount",
  "rawObj.amount"
);
content = content.replace(
  "parsedPayload.transactionType",
  "rawObj.transactionType"
);
content = content.replace(
  "parsedPayload.event",
  "rawObj.event"
);
content = content.replace(
  "parsedPayload.e2e",
  "rawObj.e2e"
);
content = content.replace(
  "parsedPayload.e2eId",
  "rawObj.e2eId"
);
content = content.replace(
  "parsedPayload.eventType",
  "rawObj.eventType"
);
content = content.replace(
  "parsedPayload.event",
  "rawObj.event"
);

fs.writeFileSync('server-misticpay.ts', content);
