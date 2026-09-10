const fs = require('fs');

const files = [
    'server-invictuspay.ts',
    'server-mercadopago.ts',
    'server-stripe.ts',
    'server-pagbank.ts',
    'server-infinitepay.ts'
];

for (const file of files) {
    let code = fs.readFileSync(file, 'utf8');

    // Replace admin imports
    code = code.replace(/import \{ getFirestore, FieldValue \} from 'firebase-admin\/firestore';/g, 
        `import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';`);

    // Replace db queries
    code = code.replace(/const db = getDb\(\);/g, `const db = getDb();`);
    
    // Replace userDoc logic:
    // const userDoc = await db.collection('users').doc(uid).get();
    // if (!userDoc.data()?.stores?.includes(storeId)) {
    code = code.replace(/const userDoc = await db\.collection\('users'\)\.doc\(uid\)\.get\(\);\s*if \(\!userDoc(?:\.data\(\))?\?\.stores\?\.includes\(storeId\)\) \{/g,
        `const storeDoc = await getDoc(doc(db, 'stores', storeId));
      if (!storeDoc.exists() || storeDoc.data()?.ownerId !== uid) {`);
      
    // Fix in Invictuspay:
    code = code.replace(/const userDoc = await db\.collection\('users'\)\.doc\(uid\)\.get\(\);\s*const userData = userDoc\.data\(\);\s*if \(\!userData\?\.stores\?\.includes\(storeId\)\) \{/g,
        `const storeDoc = await getDoc(doc(db, 'stores', storeId));
      if (!storeDoc.exists() || storeDoc.data()?.ownerId !== uid) {`);
      
    code = code.replace(/const userDoc = await db\.collection\('users'\)\.doc\(uid\)\.get\(\);\s*if \(\!userDoc\.data\(\)\?\.stores\?\.includes\(storeId\)\) \{/g,
        `const storeDoc = await getDoc(doc(db, 'stores', storeId));
      if (!storeDoc.exists() || storeDoc.data()?.ownerId !== uid) {`);

    // Replace gateway query:
    // const querySnapshot = await db.collection('seller_payment_gateways').where(...).where(...).get();
    code = code.replace(/const querySnapshot = await db\.collection\('seller_payment_gateways'\)\s*\.where\('storeId', '==', storeId\)\s*\.where\('gateway_type', '==', '([^']+)'\)\s*\.get\(\);/g,
        `const querySnapshot = await getDocs(query(collection(db, 'seller_payment_gateways'), where('storeId', '==', storeId), where('gateway_type', '==', '$1')));`);
        
    code = code.replace(/const querySnapshot = await db\.collection\('seller_payment_gateways'\)\s*\.where\('storeId', '==', storeId\)\s*\.where\('gateway_type', '==', gatewayType\)\s*\.get\(\);/g,
        `const querySnapshot = await getDocs(query(collection(db, 'seller_payment_gateways'), where('storeId', '==', storeId), where('gateway_type', '==', gatewayType)));`);

    // Replace create logic:
    // await db.collection('seller_payment_gateways').add(updateData);
    code = code.replace(/await db\.collection\('seller_payment_gateways'\)\.add\(([^)]+)\);/g,
        `await addDoc(collection(db, 'seller_payment_gateways'), $1);`);
        
    // Replace update logic:
    // await querySnapshot.docs[0].ref.update(updateData);
    code = code.replace(/await querySnapshot\.docs\[0\]\.ref\.update\(([^)]+)\);/g,
        `await updateDoc(querySnapshot.docs[0].ref, $1);`);

    // Replace FieldValue.serverTimestamp()
    code = code.replace(/FieldValue\.serverTimestamp\(\)/g, `serverTimestamp()`);
    
    // Replace data() method checking logic (already works mostly, but docs[0].data() is fine)

    fs.writeFileSync(file, code);
}
console.log('Done replacing routes');
