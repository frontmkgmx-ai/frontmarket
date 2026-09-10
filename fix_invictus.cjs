const fs = require('fs');

let code = fs.readFileSync('server-invictuspay.ts', 'utf8');

// Fix err to error
code = code.replace(/console\.error\('Erro listando cobranças:', err\);/g, "console.error('Erro listando cobranças:', error);");
code = code.replace(/catch \(err\)/g, "catch (error: any)");

// Fix FieldValue.delete() to deleteField()
if (!code.includes('deleteField')) {
  code = code.replace(/import \{ ([^}]+) \} from 'firebase\/firestore';/, "import { $1, deleteField } from 'firebase/firestore';");
}
code = code.replace(/FieldValue\.delete\(\)/g, "deleteField()");

// Fix req.user type cast
code = code.replace(/const user = req\.user;/g, "const user = (req as any).user;");
code = code.replace(/const uid = req\.user\?\.uid;/g, "const uid = (req as any).user?.uid;");

fs.writeFileSync('server-invictuspay.ts', code);
