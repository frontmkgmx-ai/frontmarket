const fs = require('fs');

console.log('--- server-notification-service.ts ---');
if (fs.existsSync('server-notification-service.ts')) {
  console.log(fs.readFileSync('server-notification-service.ts', 'utf8').slice(0, 1000));
}

console.log('--- server-email-triggers.ts ---');
if (fs.existsSync('server-email-triggers.ts')) {
  console.log(fs.readFileSync('server-email-triggers.ts', 'utf8').slice(0, 1000));
}

console.log('--- server-email.ts ---');
if (fs.existsSync('server-email.ts')) {
  console.log(fs.readFileSync('server-email.ts', 'utf8').slice(0, 1000));
}
