async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/wallet/undefined', {
      headers: { 'Authorization': 'Bearer fake-token' }
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text.substring(0, 100));
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}
run();
