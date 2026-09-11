const fs = require('fs');
let code = fs.readFileSync('src/pages/storefront/Checkout.tsx', 'utf8');

if (!code.includes('import { StreamxImage }')) {
  code = code.replace(
    "import { formatCurrency, maskCPF, maskPhone, maskCEP } from '../../lib/utils';",
    "import { formatCurrency, maskCPF, maskPhone, maskCEP } from '../../lib/utils';\nimport { StreamxImage } from '../../components/StreamxImage';"
  );
}

if (!code.includes('Image as ImageIcon')) {
  code = code.replace(
    "} from 'lucide-react';",
    "  Image as ImageIcon\n} from 'lucide-react';"
  );
}

fs.writeFileSync('src/pages/storefront/Checkout.tsx', code);
