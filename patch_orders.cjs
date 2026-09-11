const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Orders.tsx', 'utf8');

const syncCode = `
  const handleMisticSync = async (orderId: string) => {
    if (!store) return;
    try {
      setUpdatingStatus(true);
      const res = await fetch('/api/checkout/misticpay/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: store.id, orderId })
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.status === 'paid') {
          alert('Pagamento aprovado na Mistic Pay!');
          setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'paid' } : o));
          if (selectedOrder?.id === orderId) {
            setSelectedOrder({ ...selectedOrder, status: 'paid' });
          }
        } else {
          alert('Status na Mistic Pay: ' + (data.gatewayState || data.status));
        }
      } else {
        alert(data.error || 'Erro ao sincronizar.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao sincronizar.');
    } finally {
      setUpdatingStatus(false);
    }
  };
`;

code = code.replace(
  '  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {',
  syncCode + '\n  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {'
);

const buttonCode = `
                </div>
                
                {selectedOrder.status !== 'paid' && selectedOrder.status !== 'cancelled' && (
                  <div className="mt-4 flex justify-end">
                    <button
                      disabled={updatingStatus}
                      onClick={() => handleMisticSync(selectedOrder.id)}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <RefreshCw className={\`w-4 h-4 \${updatingStatus ? 'animate-spin' : ''}\`} />
                      Sincronizar Pagamento Mistic Pay
                    </button>
                  </div>
                )}
              </div>

              {/* Dados do Cliente */}
`;

code = code.replace(
  /                <\/div>\s*<\/div>\s*{\/\* Dados do Cliente \*\//,
  buttonCode
);

// Add RefreshCw to lucide-react imports if not there
if (!code.includes('RefreshCw')) {
  code = code.replace('} from \'lucide-react\';', ', RefreshCw } from \'lucide-react\';');
}

fs.writeFileSync('src/pages/admin/Orders.tsx', code);
