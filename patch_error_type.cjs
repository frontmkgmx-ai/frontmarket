const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const safeError = \(result\.error && typeof result\.error === 'object' && result\.error\.message\) \? result\.error\.message : String\(result\.error\);/g, "const safeError = (result.error && typeof result.error === 'object' && 'message' in result.error) ? (result.error as any).message : String(result.error);");

fs.writeFileSync('server.ts', code);
