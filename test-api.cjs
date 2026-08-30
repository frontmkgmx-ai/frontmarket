const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/user/start-kyc',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Data:', data));
});
req.on('error', e => console.error(e));
req.end();
