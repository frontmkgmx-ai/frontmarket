const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// We need to inject the import of generateEmailHtml inside the endpoints where it's needed
// Or just import it dynamically like others

const find1 = 'const htmlBody = `<div style="font-family: sans-serif; white-space: pre-wrap; color: #333; line-height: 1.5;">${body}</div>`;';
const replace1 = `const { generateEmailHtml } = await import('./server-email-template.js');
        const htmlBody = generateEmailHtml(body, settings.templateConfig, storeName);`;

code = code.replace(find1, replace1);

const find2 = 'const prodHtml = `<div style="font-family: sans-serif; white-space: pre-wrap; color: #333; line-height: 1.5;">${prodBody}</div>`;';
const replace2 = `const { generateEmailHtml } = await import('./server-email-template.js');
            const prodHtml = generateEmailHtml(prodBody, settings.templateConfig, storeName);`;

code = code.replace(find2, replace2);

const find3 = 'const htmlBody = `<div style="font-family: sans-serif; white-space: pre-wrap; color: #333; line-height: 1.5;">${body}</div>`;'; // This is in test-email-template
const replace3 = `const settingsSnap = await db.collection('stores').doc(storeId).collection('settings').doc('emails').get();
      const settings = settingsSnap.exists ? settingsSnap.data() : null;
      const storeSnap = await db.collection('stores').doc(storeId).get();
      const storeName = storeSnap.exists ? (storeSnap.data().name || 'Loja') : 'Loja';
      
      const { generateEmailHtml } = await import('./server-email-template.js');
      const htmlBody = generateEmailHtml(body, settings?.templateConfig, storeName);`;

code = code.replace(find3, replace3);

fs.writeFileSync('server.ts', code);
