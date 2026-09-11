const fs = require('fs');
let code = fs.readFileSync('src/layouts/DashboardLayout.tsx', 'utf8');

code = code.replace(
  "import { useAuthStore } from '../store/authStore';",
  "import { useAuthStore } from '../store/authStore';\nimport { NotificationCenter } from '../components/NotificationCenter';"
);

const headerActions = `
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationCenter />
            {activeStore && (
`;

code = code.replace(
  /<\div className="flex items-center gap-2 sm:gap-3">\s*\{activeStore && \(/,
  headerActions
);

fs.writeFileSync('src/layouts/DashboardLayout.tsx', code);
