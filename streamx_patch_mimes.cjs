const fs = require('fs');
let content = fs.readFileSync('server-streamx.ts', 'utf-8');

content = content.replace(
  "      const contentType = response.headers.get('content-type');\n      if (contentType && ALLOWED_MIME_TYPES.has(contentType.split(';')[0])) {\n        res.setHeader('Content-Type', contentType);\n      } else {\n        res.setHeader('Content-Type', 'image/jpeg');\n      }",
  "      const contentType = response.headers.get('content-type');\n      if (contentType && ALLOWED_MIME_TYPES.has(contentType.split(';')[0])) {\n        res.setHeader('Content-Type', contentType);\n      } else if (contentType && contentType.startsWith('video/')) {\n        res.setHeader('Content-Type', contentType);\n      } else {\n        res.setHeader('Content-Type', 'image/jpeg');\n      }"
);

content = content.replace(
  "Apenas JPEG, PNG, WEBP e GIF são aceitos.",
  "Apenas Imagens (JPEG, PNG, WEBP, GIF) e Vídeos (MP4, WEBM, OGG) são aceitos."
);

fs.writeFileSync('server-streamx.ts', content);
