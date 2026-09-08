const fs = require('fs');
let text = fs.readFileSync('server-invictuspay.ts', 'utf8');

// Find the last two }
let lastIndex = text.lastIndexOf('}');
if (lastIndex !== -1) {
    text = text.substring(0, lastIndex);
}
lastIndex = text.lastIndexOf('}');
if (lastIndex !== -1) {
    text = text.substring(0, lastIndex);
}

fs.writeFileSync('server-invictuspay.ts', text + `
  app.post('/api/gateways/invictuspay/:storeId/cashout', authMiddleware, async (req, res) => {
     try {
        const { storeId } = req.params;
        const { amount, key_type, key_value } = req.body;
        const uid = (req as any).user.uid;
        
        const db = getDb();
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.data()?.stores?.includes(storeId)) {
             return res.status(403).json({ error: 'Forbidden' });
        }
        
        const querySnapshot = await db.collection('seller_payment_gateways')
            .where('storeId', '==', storeId)
            .where('gateway_type', '==', 'invictuspay')
            .get();

        if (querySnapshot.empty || !querySnapshot.docs[0].data().api_key_encrypted) {
            return res.status(400).json({ error: 'Gateway não configurado' });
        }
        
        const keyToUse = decrypt(querySnapshot.docs[0].data().api_key_encrypted);
        
        const _fetch = globalThis.fetch || require('node-fetch');
        const response = await _fetch('https://api.invictuspayv2.com.br/api/v1/cashout', {
            method: 'POST',
            headers: { 
               'Content-Type': 'application/json',
               'X-Api-Key': keyToUse 
            },
            body: JSON.stringify({ amount, key_type, key_value })
        });
        
        if (response.ok) {
            const data = await response.json();
            return res.json({ success: true, cashout: data });
        } else {
            const errData = await response.text();
            return res.status(400).json({ error: 'Erro ao solicitar saque.', details: errData });
        }
     } catch(err) {
        res.status(500).json({ error: 'Internal Server Error' });
     }
  });

}
`);
