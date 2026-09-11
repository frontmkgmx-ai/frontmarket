const fs = require('fs');
let code = fs.readFileSync('src/pages/storefront/ProductDetail.tsx', 'utf8');

code = code.replace(
  "const isVideo = img.includes('?type=video') || img.match(/\\.(mp4|webm|ogg)$/i);",
  "if (!img) return; const isVideo = typeof img === 'string' && (img.includes('?type=video') || img.match(/\\.(mp4|webm|ogg)$/i));"
);

fs.writeFileSync('src/pages/storefront/ProductDetail.tsx', code);
