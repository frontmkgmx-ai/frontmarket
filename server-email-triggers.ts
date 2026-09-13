import { getAdminDb } from './server-firebase-admin.js';
import { sendEmail } from './server-email.js';
import { FieldValue } from 'firebase-admin/firestore';

interface StatusEmails {
  paid: { enabled: boolean; subject: string; body: string };
  refunded: { enabled: boolean; subject: string; body: string };
  canceled: { enabled: boolean; subject: string; body: string };
}

interface ProductEmail {
  id: string;
  productId: string;
  subject: string;
  body: string;
  enabled: boolean;
}

export async function triggerOrderStatusEmail(storeId: string, orderId: string, newStatus: 'paid' | 'refunded' | 'canceled', eventId?: string) {
  try {
    const db = getAdminDb();
    
    const settingsSnap = await db.collection('stores').doc(storeId).collection('settings').doc('emails').get();
    if (!settingsSnap.exists) return; 
    
    const settings = settingsSnap.data() as { statusEmails?: StatusEmails, productEmails?: ProductEmail[] };
    
    const statusConfig = settings.statusEmails?.[newStatus];
    if (!statusConfig || !statusConfig.enabled) return;

    const storeSnap = await db.collection('stores').doc(storeId).get();
    const storeName = storeSnap.exists ? storeSnap.data()?.name || 'Loja' : 'Loja';

    const orderSnap = await db.collection('stores').doc(storeId).collection('orders').doc(orderId).get();
    if (!orderSnap.exists) return;
    const orderData = orderSnap.data();

    const customerEmail = orderData?.customer?.email || orderData?.customerEmail;
    if (!customerEmail) return;

    const customerName = orderData?.customer?.name || orderData?.customerName || 'Cliente';
    const totalAmount = orderData?.total != null ? `R$ ${Number(orderData.total).toFixed(2).replace('.', ',')}` : '';
    const items = orderData?.items || [];
    
    const escapeHtml = (unsafe: string) => {
      return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };

    const replaceVars = (text: string) => {
      if (!text) return '';
      return text
        .replace(/\{\{customer_name\}\}/g, escapeHtml(customerName))
        .replace(/\{\{order_id\}\}/g, escapeHtml(orderId))
        .replace(/\{\{store_name\}\}/g, escapeHtml(storeName))
        .replace(/\{\{total_amount\}\}/g, escapeHtml(totalAmount));
    };

    // 1. Enviar Email de Status
    const subject = replaceVars(statusConfig.subject);
    const body = replaceVars(statusConfig.body);
    const { generateEmailHtml } = await import('./server-email-template.js');
    const htmlBody = generateEmailHtml(body, (settings as any).templateConfig, storeName);

    const deliveryId1 = eventId ? `${eventId}_status` : db.collection('email_deliveries').doc().id;
    const deliveryRef1 = db.collection('email_deliveries').doc(deliveryId1);
    
    const existing1 = await deliveryRef1.get();
    let shouldSend1 = true;
    if (existing1.exists && (existing1.data()?.status === 'sent' || existing1.data()?.status === 'delivered' || existing1.data()?.status === 'queued')) {
      shouldSend1 = false;
    }

    if (shouldSend1) {
      await deliveryRef1.set({
        id: deliveryId1,
        storeId,
        orderId,
        eventId: eventId || null,
        to: customerEmail,
        subject: subject,
        html: htmlBody,
        text: body,
        status: 'queued',
        createdAt: FieldValue.serverTimestamp()
      }, { merge: true });

      const emailRes = await sendEmail({
        to: customerEmail,
        subject,
        html: htmlBody,
        text: body
      });

      await deliveryRef1.update({
        status: emailRes.success ? 'sent' : 'failed',
        provider: 'resend',
        providerMessageId: emailRes.providerMessageId || null,
        lastErrorCode: emailRes.error ? String(emailRes.error) : null,
        lastErrorMessage: emailRes.error ? String(emailRes.error) : null,
        sentAt: emailRes.success ? FieldValue.serverTimestamp() : null,
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    // 2. Se o status for "paid", verificar e-mails específicos
    if (newStatus === 'paid' && settings.productEmails && items.length > 0) {
      for (const item of items) {
        const prodId = item.productId;
        const prodEmailRules = settings.productEmails.filter(p => p.productId === prodId && p.enabled);
        
        for (const rule of prodEmailRules) {
          const prodSubject = replaceVars(rule.subject).replace(/\{\{product_name\}\}/g, escapeHtml(item.name || 'Produto'));
          const prodBody = replaceVars(rule.body).replace(/\{\{product_name\}\}/g, escapeHtml(item.name || 'Produto'));
          const { generateEmailHtml } = await import('./server-email-template.js');
          const prodHtml = generateEmailHtml(prodBody, (settings as any).templateConfig, storeName);
          
          const deliveryId2 = eventId ? `${eventId}_prod_${prodId}` : db.collection('email_deliveries').doc().id;
          const deliveryRef2 = db.collection('email_deliveries').doc(deliveryId2);
          
          const existing2 = await deliveryRef2.get();
          if (existing2.exists && (existing2.data()?.status === 'sent' || existing2.data()?.status === 'delivered' || existing2.data()?.status === 'queued')) {
             continue;
          }

          await deliveryRef2.set({
            id: deliveryId2,
            storeId,
            orderId,
            eventId: eventId || null,
            to: customerEmail,
            subject: prodSubject,
            html: prodHtml,
            text: prodBody,
            status: 'queued',
            createdAt: FieldValue.serverTimestamp()
          }, { merge: true });

          const prodEmailRes = await sendEmail({
            to: customerEmail,
            subject: prodSubject,
            html: prodHtml,
            text: prodBody
          });

          await deliveryRef2.update({
            status: prodEmailRes.success ? 'sent' : 'failed',
            provider: 'resend',
            providerMessageId: prodEmailRes.providerMessageId || null,
            lastErrorCode: prodEmailRes.error ? String(prodEmailRes.error) : null,
            lastErrorMessage: prodEmailRes.error ? String(prodEmailRes.error) : null,
            sentAt: prodEmailRes.success ? FieldValue.serverTimestamp() : null,
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }
    }
  } catch (err: any) {
    console.error('[Email Trigger] Falha ao disparar emails automáticos:', err);
    throw err;
  }
}
