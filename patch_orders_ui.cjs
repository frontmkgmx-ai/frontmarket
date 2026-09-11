const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Orders.tsx', 'utf8');

if (!code.includes('trigger-email')) {
  code = code.replace(
    /await updateDoc\(doc\(db, 'stores', activeStore\.id, 'orders', orderId\), \{\s*status: newStatus\s*\}\);/g,
    `await updateDoc(doc(db, 'stores', activeStore.id, 'orders', orderId), {
        status: newStatus
      });
      // Try to trigger email
      try {
        await fetch(\`/api/orders/\${activeStore.id}/\${orderId}/trigger-email\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
      } catch (e) {
        console.error('Email trigger failed', e);
      }`
  );
  fs.writeFileSync('src/pages/admin/Orders.tsx', code);
}
