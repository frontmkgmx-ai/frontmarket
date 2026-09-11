const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Orders.tsx', 'utf-8');

content = content.replace(
  "  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },",
  "  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },\n  pending_verification: { label: 'Verificando Pgto', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Clock },"
);

fs.writeFileSync('src/pages/admin/Orders.tsx', content);
