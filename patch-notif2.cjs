const fs = require('fs');
let code = fs.readFileSync('src/components/NotificationCenter.tsx', 'utf8');

code = code.replace(
  "onClick={() => setIsOpen(!isOpen)}",
  `onClick={() => {
          setIsOpen(!isOpen);
          if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
          }
        }}`
);

fs.writeFileSync('src/components/NotificationCenter.tsx', code);
