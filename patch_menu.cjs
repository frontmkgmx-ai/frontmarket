const fs = require('fs');
let code = fs.readFileSync('src/layouts/DashboardLayout.tsx', 'utf8');

if (!code.includes("Mail")) {
  code = code.replace(
    "Wallet\n} from 'lucide-react';",
    "Wallet,\n  Mail\n} from 'lucide-react';"
  );
}

if (!code.includes("path: '/admin/emails'")) {
  code = code.replace(
    "{ name: 'Personalização', icon: Palette, path: '/admin/personalization' },",
    "{ name: 'Emails', icon: Mail, path: '/admin/emails' },\n    { name: 'Personalização', icon: Palette, path: '/admin/personalization' },"
  );
}

fs.writeFileSync('src/layouts/DashboardLayout.tsx', code);
