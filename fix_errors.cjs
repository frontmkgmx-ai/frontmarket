const fs = require('fs');

const files = ['server-mercadopago.ts', 'server-stripe.ts', 'server-pagbank.ts', 'server-infinitepay.ts', 'server-invictuspay.ts'];

for (const file of files) {
    let code = fs.readFileSync(file, 'utf8');
    
    // Replace res.status(500).json({ error: 'Internal Server Error' }); 
    // with better error handling
    code = code.replace(/res\.status\(500\)\.json\(\{ error: 'Internal Server Error' \}\);/g, 
        `console.error('API Error in ' + req.path + ':', error);
      if (error.code === 7 || error.message.includes('PERMISSION_DENIED')) {
          res.status(403).json({ error: 'Firebase Admin Permissions Error. Missing FIREBASE_SERVICE_ACCOUNT.' });
      } else {
          res.status(500).json({ error: 'Internal Server Error', details: error.message });
      }`);
      
    // also fix the catch in invictuspay which might be catch(err) instead of catch(error: any)
    code = code.replace(/catch\(err\)/g, 'catch(error: any)');
    code = code.replace(/res\.status\(500\)\.json\(\{ error: 'Internal Error' \}\);/g, 
        `console.error('API Error in ' + req.path + ':', error);
      res.status(500).json({ error: 'Internal Error', details: error.message });`);
      
    fs.writeFileSync(file, code);
}
