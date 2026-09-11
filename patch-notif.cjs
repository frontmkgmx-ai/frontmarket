const fs = require('fs');
let code = fs.readFileSync('src/components/NotificationCenter.tsx', 'utf8');

if (!code.includes('useRef')) {
  code = code.replace(
    "import React, { useState, useEffect } from 'react';",
    "import React, { useState, useEffect, useRef } from 'react';"
  );
}

if (!code.includes('prevNotifRef')) {
  code = code.replace(
    "const [unreadCount, setUnreadCount] = useState(0);",
    "const [unreadCount, setUnreadCount] = useState(0);\n  const prevNotifRef = useRef<any[]>([]);"
  );
}

if (code.includes('if (notifs.length > 0 && notifications.length > 0 && notifs[0].id !== notifications[0].id) {')) {
  code = code.replace(
    /if \(notifs\.length > 0 && notifications\.length > 0 && notifs\[0\]\.id !== notifications\[0\]\.id\) \{/g,
    `const prevNotifs = prevNotifRef.current;
      if (notifs.length > 0 && prevNotifs.length > 0 && notifs[0].id !== prevNotifs[0].id) {`
  );
  
  code = code.replace(
    "setNotifications(notifs);",
    "prevNotifRef.current = notifs;\n      setNotifications(notifs);"
  );
}

fs.writeFileSync('src/components/NotificationCenter.tsx', code);
