const fs = require('fs');
let code = fs.readFileSync('src/pages/storefront/Checkout.tsx', 'utf8');

const checkFunc = `
  const [checkingPayment, setCheckingPayment] = useState(false);

  const handleManualCheck = async () => {
    if (!orderId || !store?.id) return;
    try {
      setCheckingPayment(true);
      const res = await fetch('/api/checkout/misticpay/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: store.id, orderId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'paid' || data.status === 'processing' || data.status === 'shipped' || data.status === 'delivered') {
          setOrderPaid(true);
        } else {
          alert('Pagamento ainda não confirmado. Verifique se o PIX foi concluído e tente novamente em alguns segundos.');
        }
      }
    } catch (err) {
      console.error("Erro ao verificar status:", err);
      alert('Erro ao verificar status do pagamento.');
    } finally {
      setCheckingPayment(false);
    }
  };
`;

code = code.replace(
  '  const [orderPaid, setOrderPaid] = useState(false);',
  '  const [orderPaid, setOrderPaid] = useState(false);\n' + checkFunc
);

// Add button
const verifyBtn = `
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

              <div className="pt-3">
                <button
                  onClick={handleManualCheck}
                  disabled={checkingPayment}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {checkingPayment ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {checkingPayment ? 'Verificando pagamento...' : 'Já paguei (Verificar agora)'}
                </button>
              </div>
            </div>
          )}
`;

code = code.replace(
  /\s*<button[\s\S]*?onClick=\{\(\) => \{[\s\S]*?<span>\{copiedPix \? 'Copiado!' : 'Copiar'\}<\/span>\s*<\/button>\s*<\/div>\s*<\/div>\s*\)\}/,
  verifyBtn
);

// Add RefreshCw to imports if needed
if (!code.includes('RefreshCw')) {
  code = code.replace("CheckCircle,", "CheckCircle,\n  RefreshCw,");
}

fs.writeFileSync('src/pages/storefront/Checkout.tsx', code);
