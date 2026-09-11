const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Verification.tsx', 'utf8');

const regex = /if \(\!isForced\) \{[\s\S]*?setShowCameraModal\(false\);/m;

code = code.replace(
  regex,
  'setShowCameraModal(false);'
);

fs.writeFileSync('src/pages/admin/Verification.tsx', code);
