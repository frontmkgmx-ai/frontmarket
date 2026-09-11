const fs = require('fs');
let code = fs.readFileSync('server-kyc-service.ts', 'utf8');

// Adicionar notificação no caso de CPF duplicado (linha ~606)
code = code.replace(
  /t\.set\(sessionDocRef, \{\s*status: 'declined',[\s\S]*?lastEventId: eventId\s*\}, \{ merge: true \}\);/g,
  `t.set(sessionDocRef, {
          status: 'declined',
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastEventId: eventId
        }, { merge: true });

        const stores = userData?.stores || [];
        for (const storeId of stores) {
          t.set(db.collection('stores').doc(storeId).collection('notifications').doc(), {
            title: 'Documentação Recusada',
            message: 'Este documento já está vinculado a outra conta verificada.',
            type: 'error',
            read: false,
            createdAt: new Date().toISOString()
          });
        }`
);

// Adicionar notificação no caso de sucesso/update (linha ~650)
code = code.replace(
  /\.\.\.\(isApproved \|\| newStatus === 'declined' \? \{ completedAt: FieldValue\.serverTimestamp\(\) \} : \{\}\)\s*\}, \{ merge: true \}\);/g,
  `...(isApproved || newStatus === 'declined' ? { completedAt: FieldValue.serverTimestamp() } : {})
        }, { merge: true });

        const stores = userData?.stores || [];
        for (const storeId of stores) {
          t.set(db.collection('stores').doc(storeId).collection('notifications').doc(), {
            title: isApproved ? 'Documentação Aprovada' : (newStatus === 'declined' ? 'Documentação Recusada' : 'Atualização de Verificação'),
            message: isApproved ? 'Sua verificação de identidade foi aprovada com sucesso. Seus saques estão liberados!' : 
                     (newStatus === 'declined' ? 'Houve um problema com sua verificação de identidade. Por favor, acesse as Configurações.' : 'O status da sua verificação de identidade foi atualizado.'),
            type: isApproved ? 'success' : (newStatus === 'declined' ? 'error' : 'info'),
            read: false,
            createdAt: new Date().toISOString()
          });
        }`
);

fs.writeFileSync('server-kyc-service.ts', code);
