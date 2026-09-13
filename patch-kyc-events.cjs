const fs = require('fs');
let code = fs.readFileSync('server-kyc-service.ts', 'utf8');

// The replacement for duplicates
const dupSearch = `const stores = userData?.stores || [];
        for (const storeId of stores) {
          t.set(db.collection('stores').doc(storeId).collection('notifications').doc(), {
            title: 'Documentação Recusada',
            message: 'Este documento já está vinculado a outra conta verificada.',
            type: 'error',
            read: false,
            createdAt: new Date().toISOString()
          });
        }`;
const dupReplace = `const stores = userData?.stores || [];
        if (stores.length > 0) {
          import('./server-notification-service.js').then(({ processEvent }) => {
            for (const storeId of stores) {
              processEvent({
                eventId: eventId + '_dup',
                type: 'KYC_DECLINED',
                storeId,
                userId: targetUid,
                kycSessionId: sessionId,
                source: 'didit',
                occurredAt: new Date().toISOString()
              }).catch(console.error);
            }
          });
        }`;

code = code.replace(dupSearch, dupReplace);

// The replacement for updates
const updateSearch = `const stores = userData?.stores || [];
        for (const storeId of stores) {
          t.set(db.collection('stores').doc(storeId).collection('notifications').doc(), {
            title: isApproved ? 'Documentação Aprovada' : (newStatus === 'declined' ? 'Documentação Recusada' : 'Atualização de Verificação'),
            message: isApproved ? 'Sua verificação de identidade foi aprovada com sucesso. Seus saques estão liberados!' : 
                     (newStatus === 'declined' ? 'Houve um problema com sua verificação de identidade. Por favor, acesse as Configurações.' : 'O status da sua verificação de identidade foi atualizado.'),
            type: isApproved ? 'success' : (newStatus === 'declined' ? 'error' : 'info'),
            read: false,
            createdAt: new Date().toISOString()
          });
        }`;

const updateReplace = `const stores = userData?.stores || [];
        if (stores.length > 0) {
          import('./server-notification-service.js').then(({ processEvent }) => {
            for (const storeId of stores) {
              let eventType = 'KYC_STATUS_CHANGED';
              if (isApproved) eventType = 'KYC_APPROVED';
              else if (newStatus === 'declined') eventType = 'KYC_DECLINED';

              processEvent({
                eventId,
                type: eventType as any,
                storeId,
                userId: targetUid,
                kycSessionId: sessionId,
                source: 'didit',
                occurredAt: new Date().toISOString()
              }).catch(console.error);
            }
          });
        }`;

code = code.replace(updateSearch, updateReplace);

fs.writeFileSync('server-kyc-service.ts', code);
