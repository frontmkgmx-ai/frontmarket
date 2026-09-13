const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/uid: 'frontmk_test_uid'/g, "uid: '7bMXaIdAyQODxlqYCwTjcdNVgxF3'");

fs.writeFileSync('server.ts', code);
