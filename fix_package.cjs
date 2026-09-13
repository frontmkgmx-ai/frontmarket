const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
