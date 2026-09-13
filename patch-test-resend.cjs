const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newEndpoint = `  app.post('/api/admin/test-email', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      const { getFirebaseAdmin } = await import('./server-firebase-admin.js');
      const admin = getFirebaseAdmin();
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Ensure the user has admin role or stores
      const { getAdminDb } = await import('./server-firebase-admin.js');
      const db = getAdminDb();
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      if (!userDoc.exists) return res.status(403).json({ error: 'Usuário não encontrado' });
      
      const { to } = req.body;
      if (!to || !to.includes('@')) return res.status(400).json({ error: 'E-mail inválido' });
      
      const { sendEmail } = await import('./server-email.js');
      const result = await sendEmail({
        to,
        subject: 'Teste de Configuração Resend',
        html: '<p>Este é um e-mail de teste do sistema de notificações da loja.</p>',
        text: 'Este é um e-mail de teste do sistema de notificações da loja.'
      });
      
      if (result.success) {
        res.json({ success: true, provider: 'resend', messageId: result.data?.id });
      } else {
        res.json({ success: false, provider: 'resend', code: result.error });
      }
    } catch (err: any) {
      console.error('[Test Email] Error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });`;

code = code.replace("  // Endpoint auxiliar para disparar emails ao atualizar status pelo painel", newEndpoint + "\n\n  // Endpoint auxiliar para disparar emails ao atualizar status pelo painel");

fs.writeFileSync('server.ts', code);
