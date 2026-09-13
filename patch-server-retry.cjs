const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const search = `import { startD3Scheduler } from './server-d3-scheduler.js';`;
const replace = `import { startD3Scheduler } from './server-d3-scheduler.js';
import { startEmailRetryScheduler } from './server-email-retry.js';`;

code = code.replace(search, replace);

const search2 = `  startD3Scheduler(getFirestore);`;
const replace2 = `  startD3Scheduler(getFirestore);
  startEmailRetryScheduler();`;

code = code.replace(search2, replace2);

fs.writeFileSync('server.ts', code);
