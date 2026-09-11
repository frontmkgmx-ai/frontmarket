const fs = require('fs');
let content = fs.readFileSync('src/pages/storefront/ProductDetail.tsx', 'utf-8');

// Adicionar useSwipeable ou handlers nativos de touch.
// handlers nativos de touch no <div className="w-full h-full flex ...">
const touchHandlers = `
                  const [touchStart, setTouchStart] = useState<number | null>(null);
                  const [touchEnd, setTouchEnd] = useState<number | null>(null);

                  const minSwipeDistance = 50;

                  const onTouchStart = (e: React.TouchEvent) => {
                    setTouchEnd(null);
                    setTouchStart(e.targetTouches[0].clientX);
                  };

                  const onTouchMove = (e: React.TouchEvent) => {
                    setTouchEnd(e.targetTouches[0].clientX);
                  };

                  const onTouchEnd = () => {
                    if (!touchStart || !touchEnd) return;
                    const distance = touchStart - touchEnd;
                    const isLeftSwipe = distance > minSwipeDistance;
                    const isRightSwipe = distance < -minSwipeDistance;
                    
                    if (isLeftSwipe) {
                      handleNext();
                    } else if (isRightSwipe) {
                      handlePrev();
                    }
                  };
`;

content = content.replace(
  "              const handleNext = () => {\n                setCurrentMediaIndex(prev => prev === mediaItems.length - 1 ? 0 : prev + 1);\n              };",
  "              const handleNext = () => {\n                setCurrentMediaIndex(prev => prev === mediaItems.length - 1 ? 0 : prev + 1);\n              };\n\n" + touchHandlers
);

content = content.replace(
  "                  <div \n                    className=\"w-full h-full flex transition-transform duration-300 ease-in-out\" \n                    style={{ transform: `translateX(-${currentMediaIndex * 100}%)` }}\n                  >",
  "                  <div \n                    className=\"w-full h-full flex transition-transform duration-300 ease-in-out\" \n                    style={{ transform: `translateX(-${currentMediaIndex * 100}%)` }}\n                    onTouchStart={onTouchStart}\n                    onTouchMove={onTouchMove}\n                    onTouchEnd={onTouchEnd}\n                  >"
);

content = content.replace(
  "opacity-0 group-hover:opacity-100",
  "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
);
content = content.replace(
  "opacity-0 group-hover:opacity-100",
  "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
);

fs.writeFileSync('src/pages/storefront/ProductDetail.tsx', content);
