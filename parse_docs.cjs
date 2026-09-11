const https = require('https');
https.get('https://docs.misticpay.com/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const section = data.split('id="check-transaction"')[1].split('</section>')[0];
    console.log(section.substring(0, 2000).replace(/<[^>]+>/g, ' '));
  });
});
