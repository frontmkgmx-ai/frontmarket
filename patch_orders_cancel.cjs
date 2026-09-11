const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Orders.tsx', 'utf8');

code = code.replace(
  "                      selectedOrder.status === st || \n                      st === 'paid';",
  "                      selectedOrder.status === st || \n                      st === 'paid' ||\n                      selectedOrder.status === 'cancelled';"
);

fs.writeFileSync('src/pages/admin/Orders.tsx', code);
