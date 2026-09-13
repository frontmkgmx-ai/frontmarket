const fs = require('fs');

// server-email-triggers.ts
let code1 = fs.readFileSync('server-email-triggers.ts', 'utf8');
code1 = code1.replace(
  "to: customerEmail,\n      subject: subject,\n      status: emailRes.success ? 'sent' : 'failed',",
  "to: customerEmail,\n      subject: subject,\n      html: htmlBody,\n      text: body,\n      status: emailRes.success ? 'sent' : 'failed',"
);
code1 = code1.replace(
  "to: customerEmail,\n            subject: prodSubject,\n            status: prodEmailRes.success ? 'sent' : 'failed',",
  "to: customerEmail,\n            subject: prodSubject,\n            html: \`<div style=\"font-family: sans-serif; white-space: pre-wrap; color: #333; line-height: 1.5;\">\${prodBody}</div>\`,\n            text: prodBody,\n            status: prodEmailRes.success ? 'sent' : 'failed',"
);
fs.writeFileSync('server-email-triggers.ts', code1);

// server-notification-service.ts
let code2 = fs.readFileSync('server-notification-service.ts', 'utf8');
code2 = code2.replace(
  "to: sellerEmail,\n          subject,\n          status: emailRes.success ? 'sent' : 'failed',",
  "to: sellerEmail,\n          subject,\n          html: \`<div style=\"font-family: sans-serif; color: #333; line-height: 1.5;\">\${html}</div>\`,\n          text: html.replace(/<[^>]*>?/gm, ''),\n          status: emailRes.success ? 'sent' : 'failed',"
);
fs.writeFileSync('server-notification-service.ts', code2);
