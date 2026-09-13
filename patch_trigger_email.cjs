const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The block to replace:
const searchStr = `  // Endpoint auxiliar para disparar emails ao atualizar status pelo painel
  app.post('/api/orders/:storeId/:orderId/trigger-email', async (req, res) => {`;
  
const endStr = `  app.post('/api/stores/:storeId/test-email-template', async (req, res) => {`;

const startIdx = code.indexOf(searchStr);
const endIdx = code.indexOf(endStr);

if (startIdx === -1 || endIdx === -1) {
  console.log("Could not find blocks");
  process.exit(1);
}

const replacement = `  // Endpoint auxiliar para REENVIAR email de pedido pelo painel (Fluxo B)
  app.post('/api/orders/:storeId/:orderId/trigger-email', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado. Token ausente.' });
      }

      const token = authHeader.split('Bearer ')[1];
      const { getFirebaseAdmin, getAdminDb } = await import('./server-firebase-admin.js');
      const admin = getFirebaseAdmin();
      const { getAuth } = await import('firebase-admin/auth');
      const decodedToken = await getAuth(admin).verifyIdToken(token);

      const { storeId, orderId } = req.params;

      // 1-2. Autenticar vendedor e validar acesso à store
      const db = getAdminDb();
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();

      const userStores = userData?.stores || [];
      if (!userStores.includes(storeId)) {
         return res.status(403).json({ error: 'Acesso negado à loja.' });
      }

      // 3. Buscar o pedido
      const orderRef = db.collection('stores').doc(storeId).collection('orders').doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) {
        return res.status(404).json({ error: 'Pedido não encontrado.' });
      }
      const orderData = orderSnap.data();

      // 5. Localizar o campo REAL de e-mail do comprador
      const customerEmail = orderData?.customer?.email || orderData?.customerEmail;
      
      // 6. Validar o email
      if (!customerEmail || typeof customerEmail !== 'string' || !customerEmail.includes('@')) {
        return res.status(422).json({ error: 'Pedido não possui e-mail de comprador válido.' });
      }

      // 7. Montar o conteúdo usando dados persistidos
      // First get store settings
      const settingsSnap = await db.collection('stores').doc(storeId).collection('settings').doc('emails').get();
      const settings = settingsSnap.exists ? settingsSnap.data() : null;
      if (!settings || !settings.statusEmails) {
        return res.status(422).json({ error: 'Loja não possui e-mails configurados.' });
      }

      const status = orderData?.status || 'paid';
      const statusConfig = settings.statusEmails[status];
      
      const escapeHtml = (unsafe) => {
        return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      };

      const customerName = orderData?.customer?.name || orderData?.customerName || 'Cliente';
      const storeSnap = await db.collection('stores').doc(storeId).get();
      const storeName = storeSnap.exists ? (storeSnap.data().name || 'Loja') : 'Loja';
      const totalAmount = orderData?.total != null ? \`R$ \${Number(orderData.total).toFixed(2).replace('.', ',')}\` : '';

      const replaceVars = (text) => {
        if (!text) return '';
        return text
          .replace(/\{\\{customer_name\\}\\}/g, escapeHtml(customerName))
          .replace(/\{\\{order_id\\}\\}/g, escapeHtml(orderId))
          .replace(/\{\\{store_name\\}\\}/g, escapeHtml(storeName))
          .replace(/\{\\{total_amount\\}\\}/g, escapeHtml(totalAmount));
      };

      // 8. Call sendEmail
      const { sendEmail } = await import('./server-email.js');
      const results = [];
      const { FieldValue } = await import('firebase-admin/firestore');

      // Send status email
      if (statusConfig && statusConfig.enabled) {
        const subject = replaceVars(statusConfig.subject);
        const body = replaceVars(statusConfig.body);
        const htmlBody = \`<div style="font-family: sans-serif; white-space: pre-wrap; color: #333; line-height: 1.5;">\${body}</div>\`;
        
        const deliveryId = db.collection('email_deliveries').doc().id;
        const deliveryRef = db.collection('email_deliveries').doc(deliveryId);
        
        await deliveryRef.set({
          id: deliveryId,
          type: 'order_resend',
          storeId,
          orderId,
          triggeredBy: decodedToken.uid,
          to: customerEmail,
          subject,
          html: htmlBody,
          text: body,
          status: 'queued',
          createdAt: FieldValue.serverTimestamp()
        });

        const emailRes = await sendEmail({
          to: customerEmail,
          subject,
          html: htmlBody,
          text: body
        });

        await deliveryRef.update({
          status: emailRes.success ? 'sent' : 'failed',
          provider: 'resend',
          providerMessageId: emailRes.providerMessageId || null,
          lastErrorCode: emailRes.error ? String(emailRes.error) : null,
          lastErrorMessage: emailRes.error ? String(emailRes.error) : null,
          sentAt: emailRes.success ? FieldValue.serverTimestamp() : null,
          updatedAt: FieldValue.serverTimestamp()
        });
        
        results.push(emailRes);
      }
      
      // Also send product emails if paid
      if (status === 'paid' && settings.productEmails && orderData.items && orderData.items.length > 0) {
        for (const item of orderData.items) {
          const prodId = item.productId;
          const prodEmailRules = settings.productEmails.filter(p => p.productId === prodId && p.enabled);
          for (const rule of prodEmailRules) {
            const prodSubject = replaceVars(rule.subject).replace(/\{\\{product_name\\}\\}/g, escapeHtml(item.name || 'Produto'));
            const prodBody = replaceVars(rule.body).replace(/\{\\{product_name\\}\\}/g, escapeHtml(item.name || 'Produto'));
            const prodHtml = \`<div style="font-family: sans-serif; white-space: pre-wrap; color: #333; line-height: 1.5;">\${prodBody}</div>\`;
            
            const deliveryId = db.collection('email_deliveries').doc().id;
            const deliveryRef = db.collection('email_deliveries').doc(deliveryId);
            await deliveryRef.set({
              id: deliveryId,
              type: 'order_resend',
              storeId,
              orderId,
              triggeredBy: decodedToken.uid,
              to: customerEmail,
              subject: prodSubject,
              html: prodHtml,
              text: prodBody,
              status: 'queued',
              createdAt: FieldValue.serverTimestamp()
            });

            const emailRes = await sendEmail({
              to: customerEmail,
              subject: prodSubject,
              html: prodHtml,
              text: prodBody
            });

            await deliveryRef.update({
              status: emailRes.success ? 'sent' : 'failed',
              provider: 'resend',
              providerMessageId: emailRes.providerMessageId || null,
              lastErrorCode: emailRes.error ? String(emailRes.error) : null,
              lastErrorMessage: emailRes.error ? String(emailRes.error) : null,
              sentAt: emailRes.success ? FieldValue.serverTimestamp() : null,
              updatedAt: FieldValue.serverTimestamp()
            });
            results.push(emailRes);
          }
        }
      }

      if (results.length === 0) {
        return res.status(400).json({ error: 'Nenhuma regra de e-mail ativada para este pedido.' });
      }

      const allSuccess = results.every(r => r.success);
      if (allSuccess) {
        res.json({ success: true, results });
      } else {
        const getSafeError = (err) => (err && typeof err === 'object' && err.message) ? err.message : String(err);
        const errors = results.filter(r => !r.success).map(r => getSafeError(r.error));
        res.status(500).json({ error: 'Falha parcial ou total no envio.', details: errors });
      }

    } catch (err) {
      console.error('[Trigger Email] Erro:', err);
      const safeError = (err && typeof err === 'object' && err.message) ? err.message : String(err);
      res.status(500).json({ error: 'Erro ao disparar email', details: safeError });
    }
  });

`;

const newCode = code.substring(0, startIdx) + replacement + code.substring(endIdx);
fs.writeFileSync('server.ts', newCode);
