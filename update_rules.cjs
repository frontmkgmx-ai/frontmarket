const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

if (!rules.includes('seller_payment_gateways')) {
  rules = rules.replace(/match \/stores\/\{storeId\} \{/, 
    `match /seller_payment_gateways/{gatewayId} {
      allow read, write: if true;
    }
    
    match /stores/{storeId} {`);
  fs.writeFileSync('firestore.rules', rules);
  console.log('Rules updated');
}
