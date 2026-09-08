const fs = require('fs');
let text = fs.readFileSync('server-invictuspay.ts', 'utf8');
const search = `  app.post('/api/gateways/invictuspay/:storeId/cashout', authMiddleware, async (req, res) => {`;
const firstIndex = text.indexOf(search);
const lastIndex = text.lastIndexOf(search);
if (firstIndex !== lastIndex) {
    text = text.substring(0, lastIndex);
    fs.writeFileSync('server-invictuspay.ts', text + '  });\n}\n');
}
