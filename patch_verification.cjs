const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Verification.tsx', 'utf8');

// We just skip the camera check entirely since the redirect to Didit handles it.
code = code.replace(
  /      if \(checkCamera\) \{[\s\S]*?      setShowCameraModal\(false\);/,
  "      setShowCameraModal(false);"
);

fs.writeFileSync('src/pages/admin/Verification.tsx', code);
