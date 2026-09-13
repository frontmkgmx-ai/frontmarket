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

export async function triggerOrderStatusEmail(storeId: string, orderId: string, newStatus: 'paid' | 'refunded' | 'canceled') {
  try {
    const db = getAdminDb();
    
    // Buscar configurações de email da loja
    const settingsSnap = await db.collection('stores').doc(storeId).collection('settings').doc('emails').get();
    if (!settingsSnap.exists) return; // Nenhuma configuração encontrada
    
    const settings = settingsSnap.data() as { statusEmails?: StatusEmails, productEmails?: ProductEmail[] };
    
    // Verificar se o email para este status está habilitado
    const statusConfig = settings.statusEmails?.[newStatus];
    if (!statusConfig || !statusConfig.enabled) return;

    // Buscar dados da loja
    const storeSnap = await db.collection('stores').doc(storeId).get();
    const storeName = storeSnap.exists ? storeSnap.data()?.name || 'Loja' : 'Loja';

    // Buscar dados do pedido e do cliente
    const orderSnap = await db.collection('stores').doc(storeId).collection('orders').doc(orderId).get();
    if (!orderSnap.exists) return;
    const orderData = orderSnap.data();

    // Validar se tem e-mail do cliente
    const customerEmail = orderData?.customer?.email || orderData?.customerEmail;
    if (!customerEmail) return;

    const customerName = orderData?.customer?.name || orderData?.customerName || 'Cliente';
    const totalAmount = orderData?.total != null ? `R$ ${Number(orderData.total).toFixed(2).replace('.', ',')}` : '';
    const items = orderData?.items || [];
    
    // Função para trocar variáveis com escape HTML para prevenir XSS
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
    const htmlBody = `<div style="font-family: sans-serif; white-space: pre-wrap; color: #333; line-height: 1.5;">${body}</div>`;

    const emailRes = await sendEmail({
      to: customerEmail,
      subject,
      html: htmlBody,
      text: body
    });

    await db.collection('email_deliveries').add({
      storeId,
      orderId,
      to: customerEmail,
      subject: subject,
      status: emailRes.success ? 'sent' : 'failed',
      provider: 'resend',
      providerMessageId: emailRes.data?.id || null,
      lastErrorCode: emailRes.error ? (typeof emailRes.error === 'string' ? emailRes.error : emailRes.error.name) : null,
      lastErrorMessage: emailRes.error ? (typeof emailRes.error === 'string' ? emailRes.error : emailRes.error.message) : null,
      createdAt: FieldValue.serverTimestamp(),
      sentAt: emailRes.success ? FieldValue.serverTimestamp() : null
    });

    // 2. Se o status for "paid", verificar se há e-mails específicos de produtos para enviar
    if (newStatus === 'paid' && settings.productEmails && items.length > 0) {
      for (const item of items) {
        const prodId = item.productId;
        const prodEmailRules = settings.productEmails.filter(p => p.productId === prodId && p.enabled);
        
        for (const rule of prodEmailRules) {
          const prodSubject = replaceVars(rule.subject).replace(/\{\{product_name\}\}/g, escapeHtml(item.name || 'Produto'));
          const prodBody = replaceVars(rule.body).replace(/\{\{product_name\}\}/g, escapeHtml(item.name || 'Produto'));
          
          const prodEmailRes = await sendEmail({
            to: customerEmail,
            subject: prodSubject,
            html: `<div style="font-family: sans-serif; white-space: pre-wrap; color: #333; line-height: 1.5;">${prodBody}</div>`,
            text: prodBody
          });

          await db.collection('email_deliveries').add({
            storeId,
            orderId,
            to: customerEmail,
            subject: prodSubject,
            status: prodEmailRes.success ? 'sent' : 'failed',
            provider: 'resend',
            providerMessageId: prodEmailRes.data?.id || null,
            lastErrorCode: prodEmailRes.error ? (typeof prodEmailRes.error === 'string' ? prodEmailRes.error : prodEmailRes.error.name) : null,
            lastErrorMessage: prodEmailRes.error ? (typeof prodEmailRes.error === 'string' ? prodEmailRes.error : prodEmailRes.error.message) : null,
            createdAt: FieldValue.serverTimestamp(),
            sentAt: prodEmailRes.success ? FieldValue.serverTimestamp() : null
          });
        }
      }
    }
  } catch (err: any) {
    console.error('[Email Trigger] Falha ao disparar emails automáticos:', err);
  }
}
