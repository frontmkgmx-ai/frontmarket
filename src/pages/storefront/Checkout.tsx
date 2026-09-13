import React, { useState, FormEvent, useEffect } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router';
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Store } from '../../types';
import { formatCurrency, maskCPF, maskPhone, maskCEP } from '../../lib/utils';
import { StreamxImage } from '../../components/StreamxImage';
import { useCartStore } from '../../store/cartStore';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { 
  CheckCircle, XCircle, 
  ArrowLeft, 
  User, 
  MapPin, 
  ShieldCheck, 
  QrCode, 
  Copy, 
  Check, 
  Loader2,
  Lock,
  ShoppingBag,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';

export function Checkout() {
  const { store } = useOutletContext<{ store: Store }>();
  const { items, getTotal, clearCart } = useCartStore();
  const { customer, loadCustomerSession } = useCustomerAuthStore();
  const navigate = useNavigate();

  const themeColor = store.settings?.themeColor || '#4f46e5';

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [copiedPix, setCopiedPix] = useState(false);
  const [pixCopyPaste, setPixCopyPaste] = useState("");
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState("");
  const [pixQrcodeUrl, setPixQrcodeUrl] = useState("");
  const [confirmedPayer, setConfirmedPayer] = useState<{ name: string; document: string } | null>(null);

  const [orderPaid, setOrderPaid] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  // Form State - Dados do Pagador PIX e Cliente
  const [payerName, setPayerName] = useState('');
  const [payerDocument, setPayerDocument] = useState('');

  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  const [zipcode, setZipcode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

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
          alert('Pagamento ainda não confirmado. Verifique se o PIX foi concluído no seu banco e tente novamente em instantes.');
        }
      }
    } catch (err) {
      console.error("Erro ao verificar status:", err);
      alert('Erro ao verificar status do pagamento.');
    } finally {
      setCheckingPayment(false);
    }
  };
  
  const [orderCancelled, setOrderCancelled] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10 * 60); // 10 minutes in seconds

  // Timer countdown
  useEffect(() => {
    if (success && !orderPaid && !orderCancelled && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && !orderPaid) {
      setOrderCancelled(true);
      fetch('/api/checkout/misticpay/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: store?.id, orderId })
      }).catch(console.error);
    }
  }, [success, orderPaid, orderCancelled, timeLeft, store?.id, orderId]);

  // Polling ágil para confirmação automática em tempo real do PIX Mistic Pay (a cada 4 segundos)
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
          console.error("Erro ao verificar status automático:", err);
        }
      }, 4000); // Consulta a cada 4 segundos para resposta imediata ao cliente
      return () => clearInterval(interval);
    }
  }, [success, orderId, orderPaid, orderCancelled, store?.id]);

  useEffect(() => {
    if (store?.id) {
      loadCustomerSession(store.id);
    }
  }, [store?.id]);

  // Preenchimento automático quando o cliente da loja está logado
  useEffect(() => {
    if (customer && customer.storeId === store.id) {
      if (!payerName) setPayerName(customer.name || '');
      if (!payerDocument) setPayerDocument(customer.cpf ? maskCPF(customer.cpf) : '');
      if (!customerEmail) setCustomerEmail(customer.email || '');
      if (!customerPhone) setCustomerPhone(customer.phone ? maskPhone(customer.phone) : '');

      if (customer.address) {
        if (!zipcode) setZipcode(customer.address.zipcode || '');
        if (!street) setStreet(customer.address.street || '');
        if (!number) setNumber(customer.address.number || '');
        if (!complement) setComplement(customer.address.complement || '');
        if (!neighborhood) setNeighborhood(customer.address.neighborhood || '');
        if (!city) setCity(customer.address.city || '');
        if (!state) setState(customer.address.state || '');
      }
    }
  }, [customer, store?.id]);

  const total = getTotal();
  const isDigitalOnly = items.length > 0 && items.every(item => item.isDigital);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || !store) return;

    const cleanPayerName = payerName.trim();
    const cleanPayerDoc = payerDocument.replace(/\D/g, '');

    if (!cleanPayerName || cleanPayerName.length < 3) {
      alert('Por favor, informe o Nome Completo do pagador.');
      return;
    }

    if (cleanPayerDoc.length !== 11) {
      alert('Por favor, informe um CPF válido com 11 dígitos para o pagador.');
      return;
    }

    if (!customerEmail || !customerEmail.includes('@')) {
      alert('Por favor, informe um e-mail de contato válido para envio do pedido.');
      return;
    }

    setLoading(true);

    try {
      const orderPayload = {
        storeId: store.id,
        customerId: customer?.id || '',
        customerUsername: customer?.username || '',
        payerName: cleanPayerName,
        payerDocument: cleanPayerDoc,
        items,
        subtotal: total,
        total,
        customer: {
          name: cleanPayerName,
          email: customerEmail.trim(),
          document: cleanPayerDoc,
          phone: customerPhone.trim()
        },
        shippingAddress: isDigitalOnly ? null : {
          zipcode,
          street,
          number,
          complement,
          neighborhood,
          city,
          state
        }
      };

      const res = await fetch('/api/checkout/misticpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao processar pagamento via PIX.');
      }

      setOrderId(data.orderId);
      if (data.copyPaste) setPixCopyPaste(data.copyPaste);
      if (data.qrCodeBase64) setPixQrCodeBase64(data.qrCodeBase64);
      if (data.qrcodeUrl) setPixQrcodeUrl(data.qrcodeUrl);
      if (data.payer) setConfirmedPayer(data.payer);
      
      clearCart();
      setSuccess(true);
    } catch (error: any) {
      console.error("Erro ao finalizar compra:", error);
      alert(error.message || 'Erro ao processar pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Pedido Realizado com Sucesso
  if (success) {
    const displayPayerName = confirmedPayer?.name || payerName;
    const displayPayerDoc = confirmedPayer?.document || payerDocument.replace(/\D/g, '');

    return (
      <div className="max-w-2xl mx-auto py-8 sm:py-12 px-4 text-center">
        <div className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200/80 shadow-2xl space-y-6">
          <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              {orderPaid ? 'Pagamento Aprovado! 🎉' : 'Pedido Confirmado!'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              {orderPaid ? 'Seu pagamento foi confirmado com sucesso, ' : 'Obrigado pela sua compra, '}
              <strong className="text-slate-800">{displayPayerName}</strong>!
            </p>
            <div className="inline-block bg-slate-100 text-slate-800 font-mono text-xs sm:text-sm font-bold px-3 py-1.5 rounded-lg mt-2">
              Pedido #{orderId.slice(-6).toUpperCase()}
            </div>
          </div>
          
          {orderCancelled && !orderPaid && (
            <div className="bg-rose-50/70 border border-rose-200/80 p-4 sm:p-6 rounded-2xl text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-700" />
                  Pagamento Expirado
                </span>
              </div>
              <p className="text-sm text-rose-900/80 leading-relaxed">
                O tempo para pagamento via PIX expirou e o pedido foi cancelado. Por favor, gere um novo pedido.
              </p>
            </div>
          )}

          {/* Instruções PIX */}
          {!orderPaid && !orderCancelled && (
            <div className="bg-emerald-50/70 border border-emerald-200/80 p-4 sm:p-6 rounded-2xl text-left space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-emerald-700" />
                  PIX Instantâneo
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md">
                    Expira em {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-bold text-emerald-700">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Informações do Pagador Vinculadas ao PIX */}
              <div className="bg-white/80 border border-emerald-200 rounded-xl p-3 text-xs space-y-1">
                <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                  Dados do Pagador Registrado:
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between text-slate-700 font-medium">
                  <span><strong>Titular:</strong> {displayPayerName}</span>
                  <span><strong>CPF:</strong> {maskCPF(displayPayerDoc)}</span>
                </div>
                <p className="text-[11px] text-emerald-700 pt-1 leading-snug">
                  ⚠️ Pague através do aplicativo bancário vinculado ao mesmo CPF acima para validação e liberação automática imediata.
                </p>
              </div>

              {(pixQrCodeBase64 || pixQrcodeUrl) && (
                <div className="flex justify-center py-2">
                  <img 
                    src={pixQrCodeBase64 || pixQrcodeUrl} 
                    alt="QR Code PIX" 
                    className="w-44 h-44 sm:w-52 sm:h-52 rounded-xl shadow-sm border border-emerald-200 bg-white p-2" 
                  />
                </div>
              )}

              <p className="text-xs text-emerald-900/90 leading-relaxed font-medium">
                Copie o código PIX abaixo e pague na opção <strong>PIX Copia e Cola</strong> do seu banco:
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

              <div className="pt-2">
                <button
                  onClick={handleManualCheck}
                  disabled={checkingPayment}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {checkingPayment ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {checkingPayment ? 'Verificando no gateway...' : 'Já realizei o pagamento (Verificar agora)'}
                </button>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 mt-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Verificação automática ativa em tempo real...
                </div>
              </div>
            </div>
          )}

          {orderPaid && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-800 text-xs font-medium space-y-1">
              <p className="text-sm font-bold">🎉 Pagamento Confirmado com Sucesso!</p>
              <p>Os detalhes e acessos do seu pedido foram enviados para o e-mail informado.</p>
            </div>
          )}

          <div className="pt-2">
            <Link
              to={`/${store.slug}`}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md hover:opacity-90 transition-opacity"
              style={{ backgroundColor: themeColor }}
            >
              Voltar à Vitrine da Loja
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    navigate(`/${store.slug}/cart`);
    return null;
  }

  const isCustomerLoggedIn = !!(customer && customer.storeId === store.id);

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-8 px-2 sm:px-6 lg:px-8">
      <Link 
        to={`/${store.slug}/cart`} 
        className="inline-flex items-center text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Voltar ao carrinho
      </Link>

      <div className="lg:grid lg:grid-cols-12 lg:gap-x-8 lg:items-start space-y-6 lg:space-y-0">
        
        {/* Formulário de Finalização */}
        <div className="lg:col-span-7">
          <form id="checkout-form" onSubmit={handleSubmit} className="space-y-6 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm">
            
            {/* Identificação do Cliente */}
            {isCustomerLoggedIn ? (
              <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: themeColor }}>
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{customer.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">@{customer.username} • CPF: {customer.cpf}</div>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Cliente Autenticado
                </span>
              </div>
            ) : (
              <div className="bg-indigo-50/70 p-3.5 sm:p-4 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="text-xs text-indigo-900">
                  <span className="font-bold">Já possui cadastro na loja?</span> Faça login para preencher seus dados automaticamente.
                </div>
                <Link
                  to={`/${store.slug}/login`}
                  state={{ from: `/${store.slug}/checkout` }}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-3 py-1.5 rounded-xl shadow-xs transition-colors shrink-0"
                >
                  Fazer Login
                </Link>
              </div>
            )}

            {/* DADOS DO PAGADOR PIX */}
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  Dados do Pagador (PIX)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Estes dados serão vinculados à cobrança PIX para validação bancária.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Titular da Conta *
                  </label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Nome completo do titular"
                    value={payerName} 
                    onChange={e => setPayerName(e.target.value)} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Titular da conta bancária que irá pagar</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    CPF do Titular *
                  </label>
                  <input 
                    type="text" 
                    required 
                    placeholder="000.000.000-00"
                    value={payerDocument} 
                    onChange={e => setPayerDocument(maskCPF(e.target.value))} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono" 
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">CPF do titular da conta bancária</span>
                </div>
              </div>
            </div>

            {/* Dados de Contato para o Pedido */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                Contato para Envio e Acesso
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-mail para Receber o Pedido *</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="seuemail@exemplo.com"
                    value={customerEmail} 
                    onChange={e => setCustomerEmail(e.target.value)} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Onde você receberá os detalhes e acessos</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp / Telefone *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="(00) 00000-0000"
                    value={customerPhone} 
                    onChange={e => setCustomerPhone(maskPhone(e.target.value))} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono" 
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Para atualizações sobre a entrega</span>
                </div>
              </div>
            </div>

            {/* Endereço de Entrega */}
            {!isDigitalOnly && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-500" />
                Endereço de Entrega
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">CEP *</label>
                  <input 
                    type="text" 
                    required 
                    maxLength={9} 
                    value={zipcode} 
                    onChange={e => setZipcode(maskCEP(e.target.value))} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono" 
                    placeholder="00000-000"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rua / Logradouro *</label>
                  <input 
                    type="text" 
                    required 
                    value={street} 
                    onChange={e => setStreet(e.target.value)} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Número *</label>
                  <input 
                    type="text" 
                    required 
                    value={number} 
                    onChange={e => setNumber(e.target.value)} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Complemento</label>
                  <input 
                    type="text" 
                    value={complement} 
                    onChange={e => setComplement(e.target.value)} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                    placeholder="Apto, Bloco, etc"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bairro *</label>
                  <input 
                    type="text" 
                    required 
                    value={neighborhood} 
                    onChange={e => setNeighborhood(e.target.value)} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cidade *</label>
                  <input 
                    type="text" 
                    required 
                    value={city} 
                    onChange={e => setCity(e.target.value)} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Estado (UF) *</label>
                  <input 
                    type="text" 
                    required 
                    maxLength={2} 
                    value={state} 
                    onChange={e => setState(e.target.value.toUpperCase())} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono" 
                  />
                </div>
              </div>
            </div>

            )}
          </form>
        </div>

        {/* Resumo Lateral */}
        <div className="lg:col-span-5">
          <div className="bg-slate-50 rounded-3xl p-5 sm:p-6 border border-slate-200/80 sticky top-20 space-y-5">
            <h3 className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span>Resumo da Compra</span>
              <span className="text-xs text-slate-500 font-normal">{items.length} item(ns)</span>
            </h3>
            
            <ul className="divide-y divide-slate-200/80 max-h-60 overflow-y-auto pr-1 text-xs">
              {items.map((item) => (
                <li key={item.productId} className="py-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-12 aspect-video shrink-0 bg-slate-100 rounded overflow-hidden flex items-center justify-center border border-slate-200">
                      {(item as any).image ? (
                        <StreamxImage src={(item as any).image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                        {item.quantity}x
                      </span>
                      <span className="text-slate-800 line-clamp-2 font-medium leading-snug">{item.name}</span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 ml-2 shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-2 text-xs text-slate-600 pt-3 border-t border-slate-200">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Frete</span>
                <span className="font-semibold text-emerald-600">Grátis</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                <span className="font-bold text-slate-900">Total a Pagar</span>
                <span className="font-black text-indigo-600 text-base">{formatCurrency(total)}</span>
              </div>
            </div>

            <button
              type="submit"
              form="checkout-form"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-4 px-4 rounded-2xl text-sm font-bold text-white shadow-xl hover:opacity-95 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
              style={{ backgroundColor: themeColor }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processando Pedido...</span>
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4" />
                  <span>Pagar com PIX ({formatCurrency(total)})</span>
                </>
              )}
            </button>
            
            <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Ambiente protegido e criptografado
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
