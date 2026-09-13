const fs = require('fs');
let code = fs.readFileSync('server-resend.ts', 'utf8');

const search = `        // Apenas registrar por enquanto
        // Não implementar lógica de negócio de chave/produto
        
        res.status(200).json({ success: true, message: 'Webhook processado (logged)' });`;

const replace = `        // Idempotency check via Firestore
        const { getAdminDb } = await import('./server-firebase-admin.js');
        const db = getAdminDb();
        const webhookEventRef = db.collection('resend_webhook_events').doc(svix_id);
        
        const txResult = await db.runTransaction(async (t: any) => {
          const snap = await t.get(webhookEventRef);
          if (snap.exists) {
            return { alreadyProcessed: true };
          }
          t.set(webhookEventRef, {
            eventId: svix_id,
            type: eventType,
            receivedAt: require('firebase-admin/firestore').FieldValue.serverTimestamp(),
            status: 'processed',
            deliveryId: eventData?.email_id || null
          });
          return { alreadyProcessed: false };
        });

        if (txResult.alreadyProcessed) {
           console.log(\`[Resend Webhook] Webhook \${svix_id} já processado. Idempotente.\`);
           return res.status(200).json({ success: true, message: 'Already processed' });
        }

        // State Machine for Delivery
        if (eventData?.email_id) {
          const emailDeliveriesRef = db.collection('email_deliveries');
          const query = await emailDeliveriesRef.where('providerMessageId', '==', eventData.email_id).limit(1).get();
          
          if (!query.empty) {
            const deliveryDoc = query.docs[0];
            const currentData = deliveryDoc.data();
            const currentStatus = currentData.status;
            
            // Prevent state regression
            let newStatus = currentStatus;
            let updateData: any = { updatedAt: require('firebase-admin/firestore').FieldValue.serverTimestamp() };
            
            if (eventType === 'email.delivered') {
              if (currentStatus !== 'bounced' && currentStatus !== 'complained') {
                newStatus = 'delivered';
                updateData.deliveredAt = require('firebase-admin/firestore').FieldValue.serverTimestamp();
              }
            } else if (eventType === 'email.bounced') {
              newStatus = 'bounced';
              updateData.failedAt = require('firebase-admin/firestore').FieldValue.serverTimestamp();
              updateData.lastErrorCode = 'bounced';
            } else if (eventType === 'email.complained') {
              newStatus = 'complained';
            } else if (eventType === 'email.delivery_delayed') {
              newStatus = 'delivery_delayed';
            }
            
            if (newStatus !== currentStatus) {
              updateData.status = newStatus;
              await deliveryDoc.ref.update(updateData);
              console.log(\`[Resend Webhook] email_deliveries \${deliveryDoc.id} atualizado para \${newStatus}\`);
            }
          } else {
             console.log(\`[Resend Webhook] Nenhum delivery encontrado para o ID \${eventData.email_id}\`);
          }
        }

        res.status(200).json({ success: true, message: 'Webhook processado' });`;

if (code.includes(search)) {
  code = code.replace(search, replace);
} else {
  console.log("Could not find the target string to replace in server-resend.ts");
}

fs.writeFileSync('server-resend.ts', code);
