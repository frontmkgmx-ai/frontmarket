const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const searchStr = `  app.post('/api/stores/:storeId/test-email-template', async (req, res) => {`;
const endStr = `  app.get('/api/health', (req, res) => {`;

const startIdx = code.indexOf(searchStr);
const endIdx = code.indexOf(endStr);

if (startIdx === -1 || endIdx === -1) {
  console.log("Could not find blocks");
  process.exit(1);
}

const replacement = `  // Fluxo A - ENVIAR E-MAIL DE TESTE
  app.post('/api/stores/:storeId/test-email-template', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const token = authHeader.split('Bearer ')[1];
      const { getFirebaseAdmin, getAdminDb } = await import('./server-firebase-admin.js');
      const admin = getFirebaseAdmin();
      const { getAuth } = await import('firebase-admin/auth');
      const decodedToken = await getAuth(admin).verifyIdToken(token);

      const { storeId } = req.params;
      const db = getAdminDb();
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();

      const userStores = userData?.stores || [];
      if (!userStores.includes(storeId)) {
         return res.status(403).json({ error: 'Acesso negado à loja.' });
      }

      // Vendedor é o destino fixo do teste
      const sellerEmail = userData?.email;
      if (!sellerEmail || typeof sellerEmail !== 'string' || !sellerEmail.includes('@')) {
        return res.status(400).json({ error: 'E-mail do vendedor não encontrado.' });
      }

      const { subject: rawSubject, body: rawBody } = req.body;
      
      const escapeHtml = (unsafe) => {
        return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      };

      const replaceVars = (text) => {
        if (!text) return '';
        return text
          .replace(/\\{\\{customer_name\\}\\}/g, escapeHtml("João Teste"))
          .replace(/\\{\\{order_id\\}\\}/g, escapeHtml("TEST-1234"))
          .replace(/\\{\\{product_name\\}\\}/g, escapeHtml("Produto de Teste"))
          .replace(/\\{\\{store_name\\}\\}/g, escapeHtml("Minha Loja"))
          .replace(/\\{\\{total_amount\\}\\}/g, escapeHtml("R$ 99,90"));
      };

      const subject = replaceVars(rawSubject);
      const body = replaceVars(rawBody);
      const htmlBody = \`<div style="font-family: sans-serif; white-space: pre-wrap; color: #333; line-height: 1.5;">\${body}</div>\`;

      const { FieldValue } = await import('firebase-admin/firestore');
      const deliveryId = db.collection('email_deliveries').doc().id;
      const deliveryRef = db.collection('email_deliveries').doc(deliveryId);
      
      await deliveryRef.set({
        id: deliveryId,
        type: 'test',
        storeId,
        triggeredBy: decodedToken.uid,
        to: sellerEmail,
        subject,
        html: htmlBody,
        text: body,
        status: 'queued',
        createdAt: FieldValue.serverTimestamp()
      });

      const { sendEmail } = await import('./server-email.js');
      const result = await sendEmail({
        to: sellerEmail,
        subject,
        html: htmlBody,
        text: body
      });

      await deliveryRef.update({
        status: result.success ? 'sent' : 'failed',
        provider: 'resend',
        providerMessageId: result.providerMessageId || null,
        lastErrorCode: result.error ? String(result.error) : null,
        lastErrorMessage: result.error ? String(result.error) : null,
        sentAt: result.success ? FieldValue.serverTimestamp() : null,
        updatedAt: FieldValue.serverTimestamp()
      });

      if (result.success) {
        res.json({ success: true, provider: 'resend', messageId: result.providerMessageId });
      } else {
        const safeError = (result.error && typeof result.error === 'object' && result.error.message) ? result.error.message : String(result.error);
        res.status(500).json({ error: safeError });
      }
    } catch (err) {
      console.error('[Test Email Template] Error:', err);
      const safeError = (err && typeof err === 'object' && err.message) ? err.message : String(err);
      res.status(500).json({ error: 'Internal server error', details: safeError });
    }
  });

`;

const newCode = code.substring(0, startIdx) + replacement + code.substring(endIdx);
fs.writeFileSync('server.ts', newCode);
