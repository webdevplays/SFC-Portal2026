import fetch from 'node-fetch';

async function test(url: string) {
  try {
    const res = await fetch(url);
    console.log(`URL: ${url}`);
    console.log(`Status: ${res.status}`);
    const contentType = res.headers.get('content-type') || '';
    console.log(`Content-Type: ${contentType}`);
    const text = await res.text();
    console.log(`Response Snippet: ${text.substring(0, 200)}\n-----------------------------------`);
  } catch (err: any) {
    console.error(`Error on ${url}:`, err.message);
  }
}

async function run() {
  await test('http://localhost:3000/api/settings');
  await test('http://localhost:3000/api/auth/session');
  await test('http://localhost:3000/api/mysql-status');
  await test('http://localhost:3000/api/barangays');
}

run();
