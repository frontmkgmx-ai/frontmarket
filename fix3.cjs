const fs = require('fs');
let text = fs.readFileSync('server-invictuspay.ts', 'utf8');
const search = "app.post('/api/gateways/invictuspay/:storeId/cashout'";
const idx = text.indexOf(search);
if (idx > -1) {
    text = text.substring(0, idx);
    // ensure it ends with } properly
    let openCount = (text.match(/\{/g) || []).length;
    let closeCount = (text.match(/\}/g) || []).length;
    while(openCount > closeCount) {
        text += '}\n';
        closeCount++;
    }
    fs.writeFileSync('server-invictuspay.ts', text);
}
