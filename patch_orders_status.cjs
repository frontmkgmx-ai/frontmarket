const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Orders.tsx', 'utf8');

const refundFunc = `
  const handleRefund = async (orderId: string) => {
    if (!activeStore || !confirm('Tem certeza que deseja solicitar o reembolso deste pedido? O valor será devolvido ao cliente e não poderá ser desfeito.')) return;
    try {
      setUpdatingStatus(true);
      const res = await fetch('/api/checkout/misticpay/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: activeStore.id, orderId })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Reembolso solicitado com sucesso!');
        setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'refunded' } : o));
        if (selectedOrder?.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: 'refunded' });
        }
      } else {
        alert(data.error || 'Erro ao solicitar reembolso.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao solicitar reembolso.');
    } finally {
      setUpdatingStatus(false);
    }
  };
`;

code = code.replace(
  "  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {",
  refundFunc + "\n  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {"
);

const statusMapCode = `
                  {(Object.keys(statusConfig) as OrderStatus[]).map((st) => {
                    const isManualAllowed = ['processing', 'shipped', 'delivered'].includes(st);
                    const canChangeNow = ['paid', 'processing', 'shipped', 'delivered'].includes(selectedOrder.status);
                    
                    const isDisabled = 
                      updatingStatus || 
                      selectedOrder.status === st || 
                      !isManualAllowed ||
                      !canChangeNow;

                    return (
`;

code = code.replace(
  /\{\(Object\.keys\(statusConfig\) as OrderStatus\[\]\)\.map\(\(st\) => \{[\s\S]*?return \(/,
  statusMapCode
);

const actionButtonsCode = `
                {selectedOrder.status === 'pending' && (
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
                {selectedOrder.status === 'paid' && (
                  <div className="mt-4 flex justify-end">
                    <button
                      disabled={updatingStatus}
                      onClick={() => handleRefund(selectedOrder.id)}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <RotateCcw className={\`w-4 h-4 \${updatingStatus ? 'animate-spin' : ''}\`} />
                      Solicitar Reembolso
                    </button>
                  </div>
                )}
`;

code = code.replace(
  /\{\s*selectedOrder\.status !== 'paid'[\s\S]*?<\/div>\s*\)\s*\}/,
  actionButtonsCode
);

fs.writeFileSync('src/pages/admin/Orders.tsx', code);
