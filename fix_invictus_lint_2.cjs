const fs = require('fs');

let code = fs.readFileSync('server-invictuspay.ts', 'utf8');

// Fix err to error
code = code.replace(/console\.error\('Webhook processing error:', err\);/g, "console.error('Webhook processing error:', error);");

// Fix FieldValue.increment to increment (and import it)
if (!code.includes('increment')) {
  code = code.replace(/import \{ ([^}]+) \} from 'firebase\/firestore';/, "import { $1, increment } from 'firebase/firestore';");
}
code = code.replace(/FieldValue\.increment/g, "increment");

fs.writeFileSync('server-invictuspay.ts', code);
