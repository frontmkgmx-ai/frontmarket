const fs = require('fs');
let content = fs.readFileSync('src/components/StreamxImage.tsx', 'utf-8');

content = content.replace(
  "  const [blobUrl, setBlobUrl] = useState<string | null>(null);\n  const [error, setError] = useState(false);",
  "  const [blobUrl, setBlobUrl] = useState<string | null>(null);\n  const [error, setError] = useState(false);\n  const [isVideo, setIsVideo] = useState(false);"
);

content = content.replace(
  "    const url = resolveStreamxImageUrl(src);",
  "    if (src.match(/\\.(mp4|webm|ogg)$/i)) {\n      setIsVideo(true);\n    }\n\n    const url = resolveStreamxImageUrl(src);"
);

content = content.replace(
  "          if (contentType && contentType.includes('text/html')) { \n             throw new Error('Received HTML instead of image (backend might be missing)');\n          }",
  "          if (contentType && contentType.includes('text/html')) { \n             throw new Error('Received HTML instead of image (backend might be missing)');\n          }\n          if (contentType && contentType.startsWith('video/')) {\n            if (active) setIsVideo(true);\n          }"
);

content = content.replace(
  "  return <img src={blobUrl} alt={alt} className={className} {...props} />;",
  "  if (isVideo) {\n    return (\n      <video \n        src={blobUrl} \n        className={className} \n        autoPlay \n        muted \n        loop \n        playsInline\n        {...(props as any)} \n      />\n    );\n  }\n\n  return <img src={blobUrl} alt={alt} className={className} {...props} />;"
);

content = content.replace(
  "Sem imagem",
  "Sem mídia"
);

fs.writeFileSync('src/components/StreamxImage.tsx', content);
