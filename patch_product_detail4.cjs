const fs = require('fs');
let code = fs.readFileSync('src/pages/storefront/ProductDetail.tsx', 'utf8');

code = code.replace(
  'const [currentMediaIndex, setCurrentMediaIndex] = useState(0);',
  'const [currentMediaIndex, setCurrentMediaIndex] = useState(0);\n  const [touchStart, setTouchStart] = useState<number | null>(null);\n  const [touchEnd, setTouchEnd] = useState<number | null>(null);'
);

fs.writeFileSync('src/pages/storefront/ProductDetail.tsx', code);
