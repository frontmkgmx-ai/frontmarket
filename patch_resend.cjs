const fs = require('fs');

const code = `import express from 'express';
import { Webhook } from 'svix';
import { FieldValue } from 'firebase-admin/firestore';

export function setupResendRoutes(app: express.Application) {
  app.post(
    '/api/webhooks/resend',
    express.raw({ type: 'application/json' }),
    async (req: express.Request, res: express.Response) => {
      try {
        const payload = req.body;
        const headers = req.headers;
        
        const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
        
        if (!webhookSecret) {
          console.warn('[Resend Webhook] RESEND_WEBHOOK_SECRET não configurado. Rejeitando.');
          return res.status(500).json({ error: 'Webhook secret missing on server' });
        }

        const svix_id = headers['svix-id'] as string;
        const svix_timestamp = headers['svix-timestamp'] as string;
        const svix_signature = headers['svix-signature'] as string;

        if (!svix_id || !svix_timestamp || !svix_signature) {
          return res.status(400).json({ error: 'Missing svix headers' });
        }

        const wh = new Webhook(webhookSecret);
        let evt: any;

        try {
          evt = wh.verify(payload, {
            'svix-id': svix_id,
            'svix-timestamp': svix_timestamp,
            'svix-signature': svix_signature,
          });
        } catch (err: any) {
          console.error('[Resend Webhook] Verificação de assinatura falhou:', err.message);
          return res.status(401).json({ error: 'Invalid signature' });
        }

        const eventType = evt?.type;
        const eventData = evt?.data;
        const emailTo = eventData?.to?.[0] || 'unknown';
        const providerMessageId = eventData?.email_id || null;

        console.log(\`[Resend Webhook] Evento verificado. Tipo: \${eventType} | ID: \${svix_id}\`);

        const { getAdminDb } = await import('./server-firebase-admin.js');
        const db = getAdminDb();
        const webhookEventRef = db.collection('resend_webhook_events').doc(svix_id);
        
        // 1. Claim Transaction
        const claimResult = await db.runTransaction(async (t: any) => {
          const snap = await t.get(webhookEventRef);
          const now = Date.now();
          const leaseMs = 30000; // 30 seconds

          if (snap.exists) {
            const data = snap.data();
            
            if (data.status === 'processed') {
              return { claim: false, reason: 'already_processed' };
            }
            
            if (data.status === 'processing') {
              if (data.leaseUntil && data.leaseUntil > now) {
                return { claim: false, reason: 'currently_processing' };
              }
              // Lease expired, we can reclaim
            }
            
            // Reclaim (failed or expired processing)
            t.update(webhookEventRef, {
              status: 'processing',
              leaseUntil: now + leaseMs,
              attempts: (data.attempts || 0) + 1,
              updatedAt: FieldValue.serverTimestamp()
            });
            return { claim: true };
          }
          
          // New event
          t.set(webhookEventRef, {
            eventId: svix_id,
            type: eventType,
            providerMessageId: providerMessageId,
            status: 'processing',
            receivedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            leaseUntil: now + leaseMs,
            attempts: 1
          });
          return { claim: true };
        });

        if (!claimResult.claim) {
          if (claimResult.reason === 'already_processed') {
             console.log(\`[Resend Webhook] Webhook \${svix_id} já processado. Idempotente.\`);
             return res.status(200).json({ success: true, message: 'Already processed' });
          } else {
             console.log(\`[Resend Webhook] Webhook \${svix_id} já está em processamento concorrente.\`);
             return res.status(409).json({ error: 'Concurrent processing' }); // 409 forces Resend to retry later
          }
        }

        // 2. Process Downstream (State Machine for Delivery)
        try {
          if (providerMessageId) {
            const emailDeliveriesRef = db.collection('email_deliveries');
            // Busca delivery pelo ID do provider
            const query = await emailDeliveriesRef.where('providerMessageId', '==', providerMessageId).limit(1).get();
            
            if (!query.empty) {
              const deliveryDoc = query.docs[0];
              const currentData = deliveryDoc.data();
              const currentStatus = currentData.status;
              
              let newStatus = currentStatus;
              let updateData: any = { updatedAt: FieldValue.serverTimestamp() };
              
              if (eventType === 'email.delivered') {
                if (currentStatus !== 'bounced' && currentStatus !== 'complained') {
                  newStatus = 'delivered';
                  updateData.deliveredAt = FieldValue.serverTimestamp();
                }
              } else if (eventType === 'email.bounced') {
                newStatus = 'bounced';
                updateData.failedAt = FieldValue.serverTimestamp();
                updateData.lastErrorCode = 'bounced';
              } else if (eventType === 'email.complained') {
                newStatus = 'complained';
              } else if (eventType === 'email.delivery_delayed') {
                if (currentStatus !== 'delivered' && currentStatus !== 'bounced' && currentStatus !== 'complained') {
                  newStatus = 'delivery_delayed';
                }
              }
              
              if (newStatus !== currentStatus) {
                updateData.status = newStatus;
                await deliveryDoc.ref.update(updateData);
                console.log(\`[Resend Webhook] email_deliveries \${deliveryDoc.id} atualizado para \${newStatus}\`);
              }
            } else {
               console.log(\`[Resend Webhook] Nenhum delivery encontrado para o providerMessageId \${providerMessageId}\`);
               // Event is valid but uncorrelated. We persist it but don't fail.
            }
          }

          // 3. Mark as Processed
          await webhookEventRef.update({
            status: 'processed',
            processedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });

          res.status(200).json({ success: true, message: 'Webhook processado' });
        } catch (downstreamErr: any) {
          console.error('[Resend Webhook] Falha no processamento downstream:', downstreamErr);
          // 4. Mark as Failed
          await webhookEventRef.update({
            status: 'failed',
            lastError: String(downstreamErr.message || downstreamErr),
            updatedAt: FieldValue.serverTimestamp()
          }).catch(e => console.error('Failed to update event to failed:', e));
          
          return res.status(500).json({ error: 'Failed to process event' });
        }

      } catch (err: any) {
        console.error('[Resend Webhook] Erro crítico no endpoint:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );
}
`;

fs.writeFileSync('server-resend.ts', code);
