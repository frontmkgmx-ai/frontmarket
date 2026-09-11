const fs = require('fs');
let code = fs.readFileSync('src/layouts/DashboardLayout.tsx', 'utf8');

if (!code.includes('<NotificationCenter />')) {
  code = code.replace(
    /<div className="flex items-center gap-2 sm:gap-3">\s*\{activeStore && \(/,
    '<div className="flex items-center gap-2 sm:gap-3">\n            <NotificationCenter />\n            {activeStore && ('
  );
  
  if (!code.includes('import { NotificationCenter }')) {
    code = code.replace(
      "import { useAuthStore } from '../store/authStore';",
      "import { useAuthStore } from '../store/authStore';\nimport { NotificationCenter } from '../components/NotificationCenter';"
    );
  }
  
  fs.writeFileSync('src/layouts/DashboardLayout.tsx', code);
}
