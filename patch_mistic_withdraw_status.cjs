const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

const withdrawRoute = `
  /**
   * Consulta ativa de status da transação de SAQUE na Mistic Pay
   */
  app.post('/api/misticpay/withdrawals/status', express.json(), async (req, res) => {
    try {
      const { storeId, withdrawalId } = req.body;
      if (!storeId || !withdrawalId) {
        return res.status(400).json({ error: 'storeId e withdrawalId são obrigatórios' });
      }

      const db = getDb();
      const FinancialWalletService = require('./server-financial-service').FinancialWalletService;
      
      const result = await FinancialWalletService.reconcileWithdrawal(db, { storeId, withdrawalId });
      
      return res.json(result);
    } catch (err: any) {
      console.error('[MisticPay Sync Saque] Falha:', err);
      return res.status(500).json({ error: err.message });
    }
  });
`;

code = code.replace('  /**\n   * Webhook Financeiro Seguro MisticPay', withdrawRoute + '\n  /**\n   * Webhook Financeiro Seguro MisticPay');
fs.writeFileSync('server-misticpay.ts', code);
