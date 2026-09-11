const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

code = code.replace(
  "      // Simulate refund logic by deducting from wallet\n      await FinancialWalletService.debitWallet(db, {\n        storeId,\n        amountCents: Math.round(data.total * 100),\n        reason: \\`Refund for order \\${orderId}\\`,\n        type: 'refund'\n      });",
  `      // Simulate refund logic by deducting from wallet
      const walletRef = db.collection('stores').doc(storeId).collection('wallet').doc('main');
      await db.runTransaction(async (t) => {
        const walletSnap = await t.get(walletRef);
        if (walletSnap.exists) {
          const w = walletSnap.data();
          const amountCents = Math.round(data.total * 100);
          if (w.availableBalanceCents >= amountCents) {
            t.update(walletRef, {
              availableBalanceCents: w.availableBalanceCents - amountCents,
              updatedAt: new Date().toISOString()
            });
          }
        }
      });`
);

fs.writeFileSync('server-misticpay.ts', code);
