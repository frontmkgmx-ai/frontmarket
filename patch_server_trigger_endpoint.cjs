const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes('/api/orders/:storeId/:orderId/trigger-email')) {
  const endpoint = `
  // Endpoint auxiliar para disparar emails ao atualizar status pelo painel
  app.post('/api/orders/:storeId/:orderId/trigger-email', async (req, res) => {
    try {
      const { storeId, orderId } = req.params;
      const { status } = req.body;
      const { triggerOrderStatusEmail } = await import('./server-email-triggers.js');
      await triggerOrderStatusEmail(storeId, orderId, status);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao disparar email' });
    }
  });
`;

  code = code.replace(
    "app.get('/api/health', (req, res) => {",
    endpoint + "\n  app.get('/api/health', (req, res) => {"
  );
  fs.writeFileSync('server.ts', code);
}
