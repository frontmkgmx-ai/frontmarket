const fs = require('fs');
let code = fs.readFileSync('server-email-triggers.ts', 'utf8');

const find1 = 'const htmlBody = `<div style="font-family: sans-serif; white-space: pre-wrap; color: #333; line-height: 1.5;">${body}</div>`;';
const replace1 = `const { generateEmailHtml } = await import('./server-email-template.js');
    const htmlBody = generateEmailHtml(body, (settings as any).templateConfig, storeName);`;

code = code.replace(find1, replace1);

const find2 = 'const prodHtml = `<div style="font-family: sans-serif; white-space: pre-wrap; color: #333; line-height: 1.5;">${prodBody}</div>`;';
const replace2 = `const { generateEmailHtml } = await import('./server-email-template.js');
          const prodHtml = generateEmailHtml(prodBody, (settings as any).templateConfig, storeName);`;

code = code.replace(find2, replace2);

fs.writeFileSync('server-email-triggers.ts', code);
