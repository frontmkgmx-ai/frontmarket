const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

pkg.scripts.build = "rm -rf node_modules/@tailwindcss/oxide && npm install && vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs";

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
