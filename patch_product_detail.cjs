const fs = require('fs');
let code = fs.readFileSync('src/pages/storefront/ProductDetail.tsx', 'utf8');

const mediaItemsLogic = `
            {(() => {
              const mediaItems: { type: 'image' | 'video', url: string }[] = [];
              if (product.images && product.images.length > 0) {
                product.images.forEach(img => {
                  const isVideo = img.includes('?type=video') || img.match(/\\.(mp4|webm|ogg)$/i);
                  mediaItems.push({ type: isVideo ? 'video' : 'image', url: img });
                });
              }
              if (product.videoUrl) {
                mediaItems.push({ type: 'video', url: product.videoUrl });
              }
`;

code = code.replace(
  /\{\(\(\) => \{\s*const mediaItems: \{ type: 'image' \| 'video', url: string \}\[\] = \[\];\s*if \(product\.images && product\.images\.length > 0\) \{\s*product\.images\.forEach\(img => mediaItems\.push\(\{ type: 'image', url: img \}\)\);\s*\}\s*if \(product\.videoUrl\) \{\s*mediaItems\.push\(\{ type: 'video', url: product\.videoUrl \}\);\s*\}/,
  mediaItemsLogic
);

// Also change aspect-video to a more vertical friendly or dynamic container.
code = code.replace(/aspect-video overflow-hidden/g, "aspect-square sm:aspect-[4/5] overflow-hidden");

fs.writeFileSync('src/pages/storefront/ProductDetail.tsx', code);
