const fs = require('fs');

let code = fs.readFileSync('server-email-template.ts', 'utf8');

// Replace the current img tag string with one that handles missing/broken images better,
// and ensures it has width/height styling to not look broken if the URL fails to load.
code = code.replace(
  /\$\{logoUrl \? \`\<div style="text-align: center; margin-bottom: 24px;"\>\<img src="\$\{logoUrl\}" alt="Logo" style="max-height: 48px;" \/\>\<\/div\>\` : ''\}/,
  `\${logoUrl ? \`<div style="text-align: center; margin-bottom: 24px;"><img src="\${logoUrl}" alt="Logo" style="max-height: 48px; max-width: 200px; object-fit: contain; display: inline-block;" onerror="this.style.display='none'" /></div>\` : ''}`
);

fs.writeFileSync('server-email-template.ts', code);
