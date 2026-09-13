const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

pkg.engines = {
  "node": ">=22.0.0"
};

pkg.scripts.build = "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs";

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
