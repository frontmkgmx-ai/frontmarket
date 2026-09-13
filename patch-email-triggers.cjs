const fs = require('fs');
let code = fs.readFileSync('server-email-triggers.ts', 'utf8');

code = code.replace(
  /await sendEmail\(\{(.*?)\}\);/gs,
  `const emailRes = await sendEmail({$1});
    
    // Log the delivery
    await db.collection('email_deliveries').add({
      storeId,
      orderId,
      to: customerEmail,
      subject: $1.match(/subject: ([^,]+)/)?.[1] || subject,
      status: emailRes.success ? 'sent' : 'failed',
      provider: 'resend',
      providerMessageId: emailRes.data?.id || null,
      lastErrorCode: emailRes.error ? (typeof emailRes.error === 'string' ? emailRes.error : emailRes.error.name) : null,
      lastErrorMessage: emailRes.error ? (typeof emailRes.error === 'string' ? emailRes.error : emailRes.error.message) : null,
      createdAt: FieldValue.serverTimestamp(),
      sentAt: emailRes.success ? FieldValue.serverTimestamp() : null
    });`
);

if (!code.includes('FieldValue')) {
  code = code.replace(
    "import { sendEmail } from './server-email.js';",
    "import { sendEmail } from './server-email.js';\nimport { FieldValue } from 'firebase-admin/firestore';"
  );
}

fs.writeFileSync('server-email-triggers.ts', code);
