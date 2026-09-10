const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// Replace the getFirestore function definition that uses firebase-admin
code = code.replace(/const getFirestore = \(\) => \{[\s\S]*?\};/m, `import { getClientDb } from './server-firebase-client.js';\nconst getFirestore = getClientDb;`);

// ensure getClientDb is not imported multiple times
if (!code.includes("import { getClientDb } from './server-firebase-client.js';")) {
  code = code.replace(/const getFirestore = getClientDb;/g, `import { getClientDb } from './server-firebase-client.js';\nconst getFirestore = getClientDb;`);
}

fs.writeFileSync('server.ts', code);
console.log('Updated server.ts');
