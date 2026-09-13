import fetch from 'node-fetch';

async function check() {
  try {
    const r = await fetch('http://localhost:3000/api/health');
    console.log(r.status, await r.json());
  } catch (err: any) {
    console.error(err.message);
  }
}
check();
