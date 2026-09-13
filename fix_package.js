const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

if (pkg.devDependencies && pkg.devDependencies.vite) {
  // It's there
}
// Remove duplicate keys by just stringifying and rewriting it since JSON.parse removes duplicates naturally!
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
