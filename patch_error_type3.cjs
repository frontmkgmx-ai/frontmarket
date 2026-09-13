const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const safeError = result\.error \? \(typeof result\.error === 'object' && 'message' in result\.error \? \(result\.error as any\)\.message : String\(result\.error\)\) : 'Unknown Error';/g, "const errObj = result.error as any; const safeError = errObj ? (typeof errObj === 'object' && errObj.message ? errObj.message : String(errObj)) : 'Unknown Error';");

code = code.replace(/const getSafeError = \(err\) => \(err && typeof err === 'object' && err\.message\) \? err\.message : String\(err\);/g, "const getSafeError = (err: any) => (err && typeof err === 'object' && err.message) ? err.message : String(err);");

code = code.replace(/const safeError = \(err && typeof err === 'object' && err\.message\) \? err\.message : String\(err\);/g, "const safeError = (err && typeof err === 'object' && (err as any).message) ? (err as any).message : String(err);");

fs.writeFileSync('server.ts', code);
