const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Wallet.tsx', 'utf8');

const syncFn = `
  const [syncingWithdrawal, setSyncingWithdrawal] = useState<string | null>(null);

  const handleSyncWithdrawal = async (withdrawalId: string) => {
    if (!storeId) return;
    try {
      setSyncingWithdrawal(withdrawalId);
      const res = await fetch('/api/misticpay/withdrawals/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, withdrawalId })
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.reconciled) {
          alert('Status atualizado: ' + data.status);
          fetchWalletData(); // Refresh UI
        } else {
          alert('Status na Mistic Pay continua: ' + data.status + ' (' + data.reason + ')');
        }
      } else {
        alert(data.error || 'Erro ao sincronizar saque.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao sincronizar saque.');
    } finally {
      setSyncingWithdrawal(null);
    }
  };
`;

code = code.replace(
  '  const [isWithdrawing, setIsWithdrawing] = useState(false);',
  '  const [isWithdrawing, setIsWithdrawing] = useState(false);\n' + syncFn
);

code = code.replace(
  '<th className="px-6 py-3 whitespace-nowrap">Status</th>',
  '<th className="px-6 py-3 whitespace-nowrap">Status</th>\n                  <th className="px-6 py-3 whitespace-nowrap text-right">Ações</th>'
);

const actionCell = `
                        {(w.status === 'failed' || w.status === 'rejected' || w.status === 'cancelled') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-500" />
                            Falhou / Cancelado
                          </span>
                        )}
                        {w.status === 'refunded' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            <RefreshCcw className="w-3 h-3 text-slate-500" />
                            Estornado
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {(w.status === 'provider_pending' || w.status === 'processing' || w.status === 'reserved' || w.status === 'pending' || w.status === 'reconciliation_required') && (
                          <button
                            onClick={() => handleSyncWithdrawal(w.id)}
                            disabled={syncingWithdrawal === w.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                            title="Sincronizar status com a Mistic Pay"
                          >
                            <RefreshCw className={\`w-3.5 h-3.5 \${syncingWithdrawal === w.id ? 'animate-spin' : ''}\`} />
                            Verificar
                          </button>
                        )}
                      </td>
`;

code = code.replace(
  /\s*\{\(w\.status === 'failed' \|\| w\.status === 'rejected' \|\| w\.status === 'cancelled'\)[\s\S]*?Estornado\s*<\/span>\s*\)}\s*<\/td>/,
  actionCell
);

// Add RefreshCw import if not there
if (!code.includes('RefreshCw')) {
  code = code.replace("RefreshCcw", "RefreshCcw, RefreshCw");
}

fs.writeFileSync('src/pages/admin/Wallet.tsx', code);
