const fs = require('fs');
let code = fs.readFileSync('server-email-triggers.ts', 'utf8');

code = code.replace(
  "export async function triggerOrderStatusEmail(storeId: string, orderId: string, newStatus: 'paid' | 'refunded' | 'canceled') {",
  "export async function triggerOrderStatusEmail(storeId: string, orderId: string, newStatus: 'paid' | 'refunded' | 'canceled', eventId?: string) {"
);

// We need to use eventId for idempotency if it exists.
// Currently it uses: await db.collection('email_deliveries').add({ ... })
// We should use .doc() with a determinisic ID if eventId is present.

const addSearch1 = `    await db.collection('email_deliveries').add({
      storeId,
      orderId,
      to: customerEmail,
      subject: subject,
      status: emailRes.success ? 'sent' : 'failed',`;

const addReplace1 = `    const deliveryId1 = eventId ? \`\${eventId}_status\` : db.collection('email_deliveries').doc().id;
    await db.collection('email_deliveries').doc(deliveryId1).set({
      id: deliveryId1,
      storeId,
      orderId,
      eventId,
      to: customerEmail,
      subject: subject,
      status: emailRes.success ? 'sent' : 'failed',`;

if (code.includes(addSearch1)) {
  code = code.replace(addSearch1, addReplace1);
}

const addSearch2 = `          await db.collection('email_deliveries').add({
            storeId,
            orderId,
            to: customerEmail,
            subject: prodSubject,
            status: prodEmailRes.success ? 'sent' : 'failed',`;

const addReplace2 = `          const deliveryId2 = eventId ? \`\${eventId}_prod_\${prodId}\` : db.collection('email_deliveries').doc().id;
          await db.collection('email_deliveries').doc(deliveryId2).set({
            id: deliveryId2,
            storeId,
            orderId,
            eventId,
            to: customerEmail,
            subject: prodSubject,
            status: prodEmailRes.success ? 'sent' : 'failed',`;

if (code.includes(addSearch2)) {
  code = code.replace(addSearch2, addReplace2);
}

fs.writeFileSync('server-email-triggers.ts', code);
