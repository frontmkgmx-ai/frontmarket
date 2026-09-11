const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('import { CustomerOrders }')) {
  code = code.replace(
    "import { CustomerRegister } from './pages/storefront/CustomerRegister';",
    "import { CustomerRegister } from './pages/storefront/CustomerRegister';\nimport { CustomerOrders } from './pages/storefront/CustomerOrders';"
  );
  
  code = code.replace(
    '<Route path="register" element={<CustomerRegister />} />',
    '<Route path="register" element={<CustomerRegister />} />\n            <Route path="orders" element={<CustomerOrders />} />'
  );
  
  fs.writeFileSync('src/App.tsx', code);
}
