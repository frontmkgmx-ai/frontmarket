const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const devDepsList = [
  '@types/express',
  '@types/node',
  '@types/multer',
  '@types/react',
  '@types/react-dom',
  'autoprefixer',
  'esbuild',
  'tailwindcss',
  'tsx',
  'typescript',
  'vite'
];

pkg.devDependencies = {};

for (const dep of devDepsList) {
  if (pkg.dependencies[dep]) {
    pkg.devDependencies[dep] = pkg.dependencies[dep];
    delete pkg.dependencies[dep];
  }
}

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
