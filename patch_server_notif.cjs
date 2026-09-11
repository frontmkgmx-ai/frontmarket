const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

const refundNotif = `
      await orderRef.update({
        status: 'refunded',
        updatedAt: new Date().toISOString()
      });
      
      await db.collection('stores').doc(storeId).collection('notifications').add({
        title: 'Reembolso Solicitado',
        message: \`O pedido #\${orderId.slice(-6).toUpperCase()} foi reembolsado com sucesso.\`,
        type: 'success',
        read: false,
        createdAt: new Date().toISOString()
      });
`;

code = code.replace(
  /      await orderRef\.update\(\{\s*status: 'refunded',\s*updatedAt: new Date\(\)\.toISOString\(\)\s*\}\);/,
  refundNotif
);

fs.writeFileSync('server-misticpay.ts', code);
