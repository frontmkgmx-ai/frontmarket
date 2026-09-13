const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

pkg.dependencies = {
  ...pkg.dependencies,
  ...pkg.devDependencies
};
pkg.devDependencies = {};

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
