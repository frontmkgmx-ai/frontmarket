async function test() {
  const { getAuth } = await import('firebase-admin/auth');
  console.log(typeof getAuth);
}
test();
