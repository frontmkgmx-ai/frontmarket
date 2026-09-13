const fs = require('fs');
let code = fs.readFileSync('railway.toml', 'utf8');

code = code.replace('healthcheckPath = "/api/gateways/test"', 'healthcheckPath = "/api/health"');
code = code.replace('healthcheckTimeout = 100', 'healthcheckTimeout = 300');

fs.writeFileSync('railway.toml', code);
