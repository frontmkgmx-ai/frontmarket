const fs = require('fs');
let code = fs.readFileSync('server-financial-service.ts', 'utf8');

const releaseSearch = `      const curPending = Number(wallet.pendingBalanceCents) || 0;
      const curAvailable = Number(wallet.availableBalanceCents) || 0;

      // Invariantes matemáticas:
      // pending diminui exatamente netAmountCents
      // available aumenta exatamente netAmountCents
      const nextPending = Math.max(0, curPending - netAmountCents);`;

const releaseReplace = `      const curPending = Number(wallet.pendingBalanceCents) || 0;
      const curAvailable = Number(wallet.availableBalanceCents) || 0;

      if (curPending < netAmountCents) {
        throw new Error('Invariante violada: saldo pendente insuficiente para cobrir o release. Corrupção financeira detectada.');
      }

      // Invariantes matemáticas:
      // pending diminui exatamente netAmountCents
      // available aumenta exatamente netAmountCents
      const nextPending = curPending - netAmountCents;`;

if (code.includes(releaseSearch)) {
  code = code.replace(releaseSearch, releaseReplace);
}

// Check for withdrawal reservations
const wResSearch = `        const nextReserved = Math.max(0, (Number(w.reservedBalanceCents) || 0) - totalDeductedCents);`;
const wResReplace = `        const currentReserved = Number(w.reservedBalanceCents) || 0;
        if (currentReserved < totalDeductedCents) {
           throw new Error('Invariante violada: saldo reservado insuficiente para a operação.');
        }
        const nextReserved = currentReserved - totalDeductedCents;`;

if (code.includes(wResSearch)) {
  code = code.replace(new RegExp(wResSearch.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&'), 'g'), wResReplace);
}

fs.writeFileSync('server-financial-service.ts', code);
