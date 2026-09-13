const fs = require('fs');
let code = fs.readFileSync('server-misticpay.ts', 'utf8');

const search = `  app.post('/api/misticpay/withdrawals/status', express.json(), async (req, res) => {
    try {
      const { storeId, withdrawalId } = req.body;
      if (!storeId || !withdrawalId) {
        return res.status(400).json({ error: 'storeId e withdrawalId são obrigatórios' });
      }`;

const replace = `  app.post('/api/misticpay/withdrawals/status', express.json(), async (req, res) => {
    try {
      // Autenticação
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado. Token ausente.' });
      }
      const token = authHeader.split('Bearer ')[1];
      const { getAuth } = require('firebase-admin/auth');
      const { getFirebaseAdmin, getAdminDb } = require('./server-firebase-admin.js');
      const admin = getFirebaseAdmin();
      const decodedToken = await getAuth(admin).verifyIdToken(token);
      
      const { storeId, withdrawalId } = req.body;
      if (!storeId || !withdrawalId) {
        return res.status(400).json({ error: 'storeId e withdrawalId são obrigatórios' });
      }
      
      // Validação de Ownership
      const db = getAdminDb();
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();
      const userStores = userData?.stores || [];
      if (!userStores.includes(storeId)) {
        return res.status(403).json({ error: 'Acesso negado à loja ou tenant incorreto.' });
      }`;

if (code.includes(search)) {
  code = code.replace(search, replace);
}

fs.writeFileSync('server-misticpay.ts', code);
