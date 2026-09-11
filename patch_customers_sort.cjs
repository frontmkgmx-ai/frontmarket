const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Customers.tsx', 'utf-8');

content = content.replace(
  "      const dateA = new Date(a.createdAt || 0).getTime();\n      const dateB = new Date(b.createdAt || 0).getTime();",
  "      const getMs = (val: any) => typeof val?.toDate === 'function' ? val.toDate().getTime() : (val?.seconds ? val.seconds * 1000 : new Date(val || 0).getTime());\n      const dateA = getMs(a.createdAt);\n      const dateB = getMs(b.createdAt);"
);

content = content.replace(
  "      orderBy('createdAt', 'desc')",
  "      // orderBy('createdAt', 'desc') - removido para evitar falha de indexação mista"
);

fs.writeFileSync('src/pages/admin/Customers.tsx', content);
