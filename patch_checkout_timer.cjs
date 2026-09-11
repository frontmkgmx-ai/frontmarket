const fs = require('fs');
let code = fs.readFileSync('src/pages/storefront/Checkout.tsx', 'utf8');

const timerLogic = `
  const [orderCancelled, setOrderCancelled] = useState(false);
  const [timeLeft, setTimeLeft] = useState(9 * 60); // 9 minutes in seconds

  // Timer countdown
  useEffect(() => {
    if (success && !orderPaid && !orderCancelled && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && !orderPaid) {
      setOrderCancelled(true);
      // Optional: call API to cancel order on backend, or let webhook handle it
      fetch('/api/checkout/misticpay/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: store?.id, orderId })
      }).catch(console.error);
    }
  }, [success, orderPaid, orderCancelled, timeLeft, store?.id, orderId]);

  // Poll for payment status
  useEffect(() => {
    if (success && orderId && !orderPaid && !orderCancelled) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch('/api/checkout/misticpay/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storeId: store?.id, orderId })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'paid' || data.status === 'processing' || data.status === 'shipped' || data.status === 'delivered') {
              setOrderPaid(true);
              clearInterval(interval);
            }
          }
        } catch (err) {
          console.error("Erro ao verificar status:", err);
        }
      }, 60000); // Check every 1 minute
      return () => clearInterval(interval);
    }
  }, [success, orderId, orderPaid, orderCancelled, store?.id]);
`;

code = code.replace(
  /\/\/ Poll for payment status[\s\S]*?\}, \[success, orderId, orderPaid, store\?\.id\]\);/,
  timerLogic
);

const cancelUI = `
          {orderCancelled && !orderPaid && (
            <div className="bg-rose-50/70 border border-rose-200/80 p-4 sm:p-6 rounded-2xl text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-700" />
                  Pagamento Expirado
                </span>
              </div>
              <p className="text-sm text-rose-900/80 leading-relaxed">
                O tempo para pagamento via PIX expirou e o pedido foi cancelado. Por favor, faça um novo pedido.
              </p>
            </div>
          )}

          {/* Instruções PIX */}
          {!orderPaid && !orderCancelled && (
`;

code = code.replace(
  /\{\/\* Instruções PIX \*\/\}\s*\{\!orderPaid && \(/,
  cancelUI
);

// Add Timer display to PIX instructions
const timerDisplay = `
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-emerald-700" />
                  Pagamento via PIX Instantâneo
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">
                    Expira em {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-bold text-emerald-700">{formatCurrency(total)}</span>
                </div>
              </div>
`;

code = code.replace(
  /<div className="flex items-center justify-between">\s*<span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1\.5">[\s\S]*?<\/span>\s*<\/div>/,
  timerDisplay
);

// Add XCircle to lucide-react imports if not there
if (!code.includes('XCircle')) {
  code = code.replace("CheckCircle,", "CheckCircle,\n  XCircle,");
}

fs.writeFileSync('src/pages/storefront/Checkout.tsx', code);
