const fs = require('fs');
let content = fs.readFileSync('src/components/StreamxImage.tsx', 'utf-8');

content = content.replace(
  "          if (contentType && contentType.includes('text/html')) { \n             throw new Error('Received HTML instead of image (backend might be missing)');\n          }\n          const blob = await res.blob();",
  "          if (contentType && contentType.includes('text/html')) { \n             throw new Error('Received HTML instead of image (backend might be missing)');\n          }\n          if (contentType && contentType.startsWith('video/')) {\n            if (active) setIsVideo(true);\n          }\n          const blob = await res.blob();"
);

fs.writeFileSync('src/components/StreamxImage.tsx', content);
