const fs = require('fs');

let code = fs.readFileSync('server-invictuspay.ts', 'utf8');

// Fix FieldValue.delete() to deleteField() since I previously missed some
code = code.replace(/FieldValue\.delete\(\)/g, "deleteField()");

// Fix err to error
code = code.replace(/console\.error\('Erro listando cobranças:', err\);/g, "console.error('Erro listando cobranças:', error);");
code = code.replace(/catch \(err\)/g, "catch (error: any)");

// Fix req.user type cast
code = code.replace(/const user = req\.user;/g, "const user = (req as any).user;");
code = code.replace(/const uid = req\.user\?\.uid;/g, "const uid = (req as any).user?.uid;");

fs.writeFileSync('server-invictuspay.ts', code);
