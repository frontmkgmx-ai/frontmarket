import { sendEmail } from './server-email.js';

sendEmail({
  to: 'frontmk.gmx@gmail.com',
  subject: 'Test',
  html: '<p>Test</p>',
  text: 'Test'
}).then(console.log).catch(console.error);
