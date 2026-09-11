const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("import { EmailsConfig }")) {
  code = code.replace(
    "import { Personalization } from './pages/admin/Personalization';",
    "import { Personalization } from './pages/admin/Personalization';\nimport { EmailsConfig } from './pages/admin/EmailsConfig';"
  );
}

if (!code.includes("path=\"emails\"")) {
  code = code.replace(
    "<Route path=\"personalization\" element={<Personalization />} />",
    "<Route path=\"emails\" element={<EmailsConfig />} />\n                <Route path=\"personalization\" element={<Personalization />} />"
  );
}

fs.writeFileSync('src/App.tsx', code);
