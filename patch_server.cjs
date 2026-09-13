const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newEndpoint = `
  app.post('/api/stores/:storeId/test-email-template', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      const { getFirebaseAdmin, getAdminDb } = await import('./server-firebase-admin.js');
      const admin = getFirebaseAdmin();
      const { getAuth } = require('firebase-admin/auth');
      const decodedToken = await getAuth(admin).verifyIdToken(token);
      
      const { storeId } = req.params;
      const db = getAdminDb();
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();
      
      const userStores = userData?.stores || [];
      if (!userStores.includes(storeId)) {
         return res.status(403).json({ error: 'Acesso negado à loja.' });
      }
      
      const sellerEmail = userData?.email;
      if (!sellerEmail) {
        return res.status(400).json({ error: 'E-mail do vendedor não encontrado.' });
      }

      const { subject: rawSubject, body: rawBody } = req.body;
      
      const escapeHtml = (unsafe) => {
        return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      };

      const replaceVars = (text) => {
        if (!text) return '';
        return text
          .replace(/\{\{customer_name\}\}/g, escapeHtml("João Teste"))
          .replace(/\{\{order_id\}\}/g, escapeHtml("TEST-1234"))
          .replace(/\{\{product_name\}\}/g, escapeHtml("Produto de Teste"))
          .replace(/\{\{store_name\}\}/g, escapeHtml("Minha Loja"))
          .replace(/\{\{total_amount\}\}/g, escapeHtml("R$ 99,90"));
      };

      const subject = replaceVars(rawSubject);
      const body = replaceVars(rawBody);
      const htmlBody = \`<div style="font-family: sans-serif; white-space: pre-wrap; color: #333; line-height: 1.5;">\${body}</div>\`;

      const { sendEmail } = await import('./server-email.js');
      const result = await sendEmail({
        to: sellerEmail,
        subject,
        html: htmlBody,
        text: body
      });

      if (result.success) {
        res.json({ success: true, provider: 'resend', messageId: result.providerMessageId });
      } else {
        res.status(500).json({ success: false, provider: 'resend', code: result.error });
      }
    } catch (err) {
      console.error('[Test Email Template] Error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
`;

code = code.replace("app.get('/api/health'", newEndpoint + "\n  app.get('/api/health'");
fs.writeFileSync('server.ts', code);
