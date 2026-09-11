const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Orders.tsx', 'utf-8');

content = content.replace(
  "                      (selectedOrder.status === 'pending' && st !== 'cancelled') || \n                      (st === 'refunded' && (selectedOrder.status === 'pending' || selectedOrder.status === 'cancelled'));",
  "                      (selectedOrder.status === 'pending' && st !== 'cancelled');"
);

fs.writeFileSync('src/pages/admin/Orders.tsx', content);
