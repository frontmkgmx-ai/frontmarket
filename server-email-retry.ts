import { getAdminDb } from './server-firebase-admin.js';
import { sendEmail } from './server-email.js';

export async function runEmailRetryCycle() {
  const db = getAdminDb();
  const now = new Date();
  
  try {
    const deliveriesRef = db.collection('email_deliveries');
    const query = await deliveriesRef
      .where('status', '==', 'failed')
      .where('retryCount', '<', 3)
      .limit(10)
      .get();

    for (const doc of query.docs) {
      const data = doc.data();
      
      // Basic check for permanent errors
      const errStr = String(data.lastErrorCode || '').toLowerCase() + ' ' + String(data.lastErrorMessage || '').toLowerCase();
      const isPermanent = errStr.includes('not configured') || errStr.includes('invalid') || errStr.includes('unauthorized') || errStr.includes('missing');
      
      if (isPermanent) {
         await doc.ref.update({ status: 'permanent_failure', updatedAt: require('firebase-admin/firestore').FieldValue.serverTimestamp() });
         continue;
      }
      
      // Delay check based on retryCount
      const retryCount = data.retryCount || 0;
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(0);
      const delayMs = Math.pow(2, retryCount) * 60 * 1000; // 1m, 2m, 4m
      if (now.getTime() - createdAt.getTime() < delayMs) {
         continue; // Not ready yet
      }

      console.log(`[Email Retry] Retentando envio ${doc.id} (Tentativa ${retryCount + 1})`);
      
      const emailRes = await sendEmail({
        to: data.to,
        subject: data.subject,
        html: data.html || data.text, // we don't store html, so fallback. We should probably store body if we want perfect retries, but for now we skip.
        text: data.text
      });

      if (emailRes.success) {
        await doc.ref.update({
          status: 'sent',
          providerMessageId: emailRes.providerMessageId || null,
          sentAt: require('firebase-admin/firestore').FieldValue.serverTimestamp(),
          updatedAt: require('firebase-admin/firestore').FieldValue.serverTimestamp(),
          retryCount: retryCount + 1
        });
      } else {
        await doc.ref.update({
          lastErrorCode: emailRes.error ? (String(emailRes.error)) : null,
          lastErrorMessage: emailRes.error ? (String(emailRes.error)) : null,
          retryCount: retryCount + 1,
          status: retryCount >= 2 ? 'permanent_failure' : 'failed',
          updatedAt: require('firebase-admin/firestore').FieldValue.serverTimestamp()
        });
      }
    }
  } catch (err) {
    console.error('[Email Retry] Falha no ciclo de retry:', err);
  }
}

let retryInterval: NodeJS.Timeout | null = null;
export function startEmailRetryScheduler() {
  if (retryInterval) return;
  // Run every 2 minutes
  retryInterval = setInterval(runEmailRetryCycle, 2 * 60 * 1000);
  console.log('[Email Retry] Scheduler iniciado');
}
