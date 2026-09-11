const fs = require('fs');
let code = fs.readFileSync('src/pages/storefront/Checkout.tsx', 'utf8');

const hookRegex = /\s*const \[orderPaid[\s\S]*?\}, \[success, orderId, orderPaid, store\?\.id\]\);\n/;
const matched = code.match(hookRegex);

if (matched) {
  code = code.replace(matched[0], '');
  // Insert it after const [pixQrCodeBase64
  code = code.replace(
    '  const [pixQrCodeBase64, setPixQrCodeBase64] = useState("");',
    '  const [pixQrCodeBase64, setPixQrCodeBase64] = useState("");\n' + matched[0]
  );
  fs.writeFileSync('src/pages/storefront/Checkout.tsx', code);
} else {
  console.log("Not found hook");
}
