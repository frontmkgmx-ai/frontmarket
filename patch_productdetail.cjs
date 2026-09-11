const fs = require('fs');
let code = fs.readFileSync('src/pages/storefront/ProductDetail.tsx', 'utf8');

code = code.replace(
  /className=\{\`aspect-square sm:aspect-\[4\/5\] overflow-hidden bg-slate-100/g,
  "className={`aspect-video overflow-hidden bg-slate-100"
);

fs.writeFileSync('src/pages/storefront/ProductDetail.tsx', code);
