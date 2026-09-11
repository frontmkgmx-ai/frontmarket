const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/ProductForm.tsx', 'utf8');

code = code.replace(
  "const downloadURL = await uploadFileToStreamx(file);",
  "let downloadURL = await uploadFileToStreamx(file);\n      if (file.type.startsWith('video/')) {\n        downloadURL += '?type=video';\n      }"
);

// Also let's change `aspect-video` to `aspect-square` in the thumbnail previews to not be 16:9 restricted
code = code.replace(/aspect-video/g, "aspect-square object-cover");

fs.writeFileSync('src/pages/admin/ProductForm.tsx', code);
