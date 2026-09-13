import { getAdminDb } from './server-firebase-admin.js';
const db = getAdminDb();

async function test() {
  let eventId: string | undefined = undefined;
  try {
    await db.collection('email_deliveries').doc('test-123').set({
      eventId: eventId,
      status: 'queued'
    }, { merge: true });
    console.log("Success");
  } catch (err: any) {
    console.log("Error:", err.message);
  }
}
test().then(() => process.exit(0));
