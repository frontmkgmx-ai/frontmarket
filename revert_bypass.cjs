const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const decodedToken = \{ uid: '7bMXaIdAyQODxlqYCwTjcdNVgxF3' \}; \/\/ await getAuth\(admin\)\.verifyIdToken\(token\);/g, "const decodedToken = await getAuth(admin).verifyIdToken(token);");
code = code.replace(/if \(false\) \{/g, "if (!authHeader || !authHeader.startsWith('Bearer ')) {");

fs.writeFileSync('server.ts', code);
