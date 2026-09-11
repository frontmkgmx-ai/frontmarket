const fs = require('fs');
let code = fs.readFileSync('src/pages/storefront/ProductDetail.tsx', 'utf8');

if (!code.includes('const [touchStart, setTouchStart] = useState')) {
  code = code.replace(
    'const [currentMediaIndex, setCurrentMediaIndex] = useState(0);',
    'const [currentMediaIndex, setCurrentMediaIndex] = useState(0);\n  const [touchStart, setTouchStart] = useState<number | null>(null);\n  const [touchEnd, setTouchEnd] = useState<number | null>(null);'
  );
}

const badBlockRegex = /\{\(\(\) => \{[\s\S]*?const \[touchStart, setTouchStart\] = useState<number \| null>\(null\);[\s\S]*?const \[touchEnd, setTouchEnd\] = useState<number \| null>\(null\);[\s\S]*?const minSwipeDistance = 50;[\s\S]*?return \([\s\S]*?<\/div>\s*<\/>\s*\);\s*\}\)\(\)\}/m;

// We need to replace the entire IIFE content carefully.
// Instead of a huge regex, let's just do a string replacement.
code = code.replace(/const \[touchStart, setTouchStart\] = useState<number \| null>\(null\);/g, '');
code = code.replace(/const \[touchEnd, setTouchEnd\] = useState<number \| null>\(null\);/g, '');

fs.writeFileSync('src/pages/storefront/ProductDetail.tsx', code);
