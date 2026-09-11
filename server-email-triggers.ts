import { getAdminDb } from './server-firebase-admin.js';
import { sendEmail } from './server-email.js';

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
    
    // Função para trocar variáveis
    const replaceVars = (text: string) => {
      if (!text) return '';
      return text
        .replace(/\{\{customer_name\}\}/g, customerName)
        .replace(/\{\{order_id\}\}/g, orderId)
        .replace(/\{\{store_name\}\}/g, storeName)
        .replace(/\{\{total_amount\}\}/g, totalAmount);
    };

    // 1. Enviar Email de Status
    const subject = replaceVars(statusConfig.subject);
    const body = replaceVars(statusConfig.body);

    // Formatar body para HTML básico mantendo quebras de linha
    const htmlBody = `<div style="font-family: sans-serif; white-space: pre-wrap; color: #333; line-height: 1.5;">${body}</div>`;

    await sendEmail({
      to: customerEmail,
      subject,
      html: htmlBody,
      text: body
    });

    // 2. Se o status for "paid", verificar se há e-mails específicos de produtos para enviar
    if (newStatus === 'paid' && settings.productEmails && items.length > 0) {
      for (const item of items) {
        const prodId = item.productId;
        const prodEmailRules = settings.productEmails.filter(p => p.productId === prodId && p.enabled);
        
        for (const rule of prodEmailRules) {
          const prodSubject = replaceVars(rule.subject).replace(/\{\{product_name\}\}/g, item.name || 'Produto');
          const prodBody = replaceVars(rule.body).replace(/\{\{product_name\}\}/g, item.name || 'Produto');
          
          await sendEmail({
            to: customerEmail,
            subject: prodSubject,
            html: `<div style="font-family: sans-serif; white-space: pre-wrap; color: #333; line-height: 1.5;">${prodBody}</div>`,
            text: prodBody
          });
        }
      }
    }

  } catch (err: any) {
    console.error('[Email Trigger] Falha ao disparar emails automáticos:', err);
  }
}
