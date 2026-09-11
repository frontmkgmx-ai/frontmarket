const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Orders.tsx', 'utf-8');

content = content.replace(
  "                      st === 'paid' || \n                      (selectedOrder.status === 'pending' && st !== 'cancelled');",
  "                      st === 'paid';"
);

fs.writeFileSync('src/pages/admin/Orders.tsx', content);
