const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Orders.tsx', 'utf8');

if (!code.includes('import { auth } from ')) {
  code = code.replace(
    "import { db } from '../../firebase/config';",
    "import { db, auth } from '../../firebase/config';"
  );
}

const oldFetch = `        await fetch(\`/api/orders/\${activeStore.id}/\${orderId}/trigger-email\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });`;

const newFetch = `        const token = await auth.currentUser?.getIdToken();
        await fetch(\`/api/orders/\${activeStore.id}/\${orderId}/trigger-email\`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${token}\`
          },
          body: JSON.stringify({ status: newStatus })
        });`;

code = code.replace(oldFetch, newFetch);

fs.writeFileSync('src/pages/admin/Orders.tsx', code);
