const fs = require('fs');
let code = fs.readFileSync('src/pages/storefront/Checkout.tsx', 'utf8');

const useEffectCode = `
  const [orderPaid, setOrderPaid] = useState(false);

  // Poll for payment status
  useEffect(() => {
    if (success && orderId && !orderPaid) {
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
      }, 5000); // Check every 5 seconds
      return () => clearInterval(interval);
    }
  }, [success, orderId, orderPaid, store?.id]);
`;

code = code.replace(
  "  const [success, setSuccess] = useState(false);",
  "  const [success, setSuccess] = useState(false);\n" + useEffectCode
);

code = code.replace(
  "<h2>Pedido Confirmado!</h2>",
  "<h2>{orderPaid ? 'Pagamento Aprovado!' : 'Pedido Confirmado!'}</h2>"
);
code = code.replace(
  "text-slate-900\">Pedido Confirmado!</h2>",
  "text-slate-900\">{orderPaid ? 'Pagamento Aprovado! 🎉' : 'Pedido Confirmado!'}</h2>"
);

code = code.replace(
  "Obrigado pela sua compra, ",
  "{orderPaid ? 'Seu pagamento foi confirmado com sucesso, ' : 'Obrigado pela sua compra, '}"
);

// If orderPaid, hide the PIX instructions
const replacePix = `
          {/* Instruções PIX */}
          {!orderPaid && (
            <div className="bg-emerald-50/70 border border-emerald-200/80 p-4 sm:p-6 rounded-2xl text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-emerald-700" />
                  Pagamento via PIX Instantâneo
                </span>
                <span className="text-xs font-bold text-emerald-700">{formatCurrency(total)}</span>
              </div>

              {pixQrCodeBase64 && (
                <div className="flex justify-center py-2">
                  <img src={pixQrCodeBase64} alt="QR Code PIX" className="w-40 h-40 sm:w-48 sm:h-48 rounded-lg shadow-sm" />
                </div>
              )}

              <p className="text-xs text-emerald-900/80 leading-relaxed">
                Copie o código PIX abaixo e pague pelo app do seu banco para confirmação imediata do pedido:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={pixCopyPaste || ""}
                  className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 select-all"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pixCopyPaste || "");
                    setCopiedPix(true);
                    setTimeout(() => setCopiedPix(false), 2500);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  {copiedPix ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          )}
`;

code = code.replace(
  /\s*{\/\* Instruções PIX \*\/}[\s\S]*?(?=\s*<div className="pt-2">)/,
  replacePix
);

fs.writeFileSync('src/pages/storefront/Checkout.tsx', code);
