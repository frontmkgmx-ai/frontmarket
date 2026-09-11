const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

// 1. Injetar o import
if (!code.includes('import { triggerOrderStatusEmail }')) {
  code = code.replace(
    "import { WebhookEventRecord } from './server-webhook-service.js';",
    "import { WebhookEventRecord } from './server-webhook-service.js';\nimport { triggerOrderStatusEmail } from './server-email-triggers.js';"
  );
}

// 2. Injetar trigger no checker de poll (linha ~428)
if (!code.includes("triggerOrderStatusEmail(storeId, orderId, 'paid')")) {
  code = code.replace(
    /t\.update\(orderRef, \{\s*status: 'paid',/g,
    "t.update(orderRef, { status: 'paid',"
  );
  
  // We need to insert it after the transaction commits...
  // Ah, wait. The transaction returns `res.json({ status: 'paid' })`.
  // Let's insert it before `return res.json({ status: 'paid' })`.
  code = code.replace(
    /return res\.json\(\{ status: 'paid' \}\);/g,
    "triggerOrderStatusEmail(storeId, orderId, 'paid').catch(console.error);\n        return res.json({ status: 'paid' });"
  );
}

// 3. Injetar trigger no webhook (linha ~749)
if (!code.includes("triggerOrderStatusEmail(storeId, orderId, 'paid')")) {
  code = code.replace(
    /await orderDoc\.ref\.update\(\{[\s\S]*?status: 'paid',[\s\S]*?\}\);[\s\S]*?console\.log\(`\[MisticPay Webhook\] Pedido \$\{orderId\} marcado como pago\.`\);/g,
    "await orderDoc.ref.update({ status: 'paid', paidAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });\n          console.log(`[MisticPay Webhook] Pedido ${orderId} marcado como pago.`);\n          triggerOrderStatusEmail(storeId, orderId, 'paid').catch(console.error);"
  );
}

// 4. Injetar trigger no refund (linha ~335)
if (!code.includes("triggerOrderStatusEmail(storeId, orderId, 'refunded')")) {
  code = code.replace(
    /await orderRef\.update\(\{[\s\S]*?status: 'refunded',[\s\S]*?\}\);/g,
    "await orderRef.update({ status: 'refunded', updatedAt: FieldValue.serverTimestamp(), refundedAt: FieldValue.serverTimestamp(), refundReason: 'MisticPay Refund' });\n      triggerOrderStatusEmail(storeId, orderId, 'refunded').catch(console.error);"
  );
}

fs.writeFileSync('server-misticpay.ts', code);
