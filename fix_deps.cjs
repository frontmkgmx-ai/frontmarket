const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Tools needed to BUILD the app on the server
const buildTools = [
  'vite',
  'tailwindcss',
  'esbuild',
  'typescript',
  'tsx',
  'autoprefixer',
  '@types/node',
  '@types/express',
  '@types/multer',
  '@types/react',
  '@types/react-dom'
];

if (!pkg.dependencies) pkg.dependencies = {};

if (pkg.devDependencies) {
  for (const tool of buildTools) {
    if (pkg.devDependencies[tool]) {
      pkg.dependencies[tool] = pkg.devDependencies[tool];
      delete pkg.devDependencies[tool];
    }
  }
}

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
