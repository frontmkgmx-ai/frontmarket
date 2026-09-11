const fs = require('fs');

let layoutCode = fs.readFileSync('src/layouts/StorefrontLayout.tsx', 'utf8');
if (!layoutCode.includes('Package,')) {
  layoutCode = layoutCode.replace("LogOut", "LogOut, Package");
  fs.writeFileSync('src/layouts/StorefrontLayout.tsx', layoutCode);
}

let checkoutCode = fs.readFileSync('src/pages/storefront/Checkout.tsx', 'utf8');
if (!checkoutCode.includes('XCircle,')) {
  checkoutCode = checkoutCode.replace("CheckCircle", "CheckCircle, XCircle");
  fs.writeFileSync('src/pages/storefront/Checkout.tsx', checkoutCode);
}
