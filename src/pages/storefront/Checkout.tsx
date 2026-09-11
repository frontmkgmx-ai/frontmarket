import React, { useState, FormEvent, useEffect } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router';
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Store } from '../../types';
import { formatCurrency, maskCPF, maskPhone, maskCEP } from '../../lib/utils';
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


  const [orderPaid, setOrderPaid] = useState(false);

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



  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerDoc, setCustomerDoc] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  const [zipcode, setZipcode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  useEffect(() => {
    if (store?.id) {
      loadCustomerSession(store.id);
    }
  }, [store?.id]);

  // Preenchimento automático quando o cliente da loja está logado
  useEffect(() => {
    if (customer && customer.storeId === store.id) {
      setCustomerName(customer.name || '');
      setCustomerEmail(customer.email || '');
      setCustomerDoc(customer.cpf || '');
      setCustomerPhone(customer.phone || '');

      if (customer.address) {
        setZipcode(customer.address.zipcode || '');
        setStreet(customer.address.street || '');
        setNumber(customer.address.number || '');
        setComplement(customer.address.complement || '');
        setNeighborhood(customer.address.neighborhood || '');
        setCity(customer.address.city || '');
        setState(customer.address.state || '');
      }
    }
  }, [customer, store.id]);

  const total = getTotal();
  const isDigitalOnly = items.length > 0 && items.every(item => item.isDigital);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || !store || !customer) return;
    setLoading(true);

    try {
      const orderPayload = {
        storeId: store.id,
        customerId: customer.id,
        customerUsername: customer.username,
        items,
        subtotal: total,
        total,
        customer: {
          name: customerName || customer.name,
          email: customerEmail || customer.email || '',
          document: customerDoc || customer.cpf,
          phone: customerPhone || customer.phone
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
        throw new Error(data.error || 'Falha ao processar pagamento.');
      }

      setOrderId(data.orderId);
      if (data.copyPaste) setPixCopyPaste(data.copyPaste);
      if (data.qrCodeBase64) setPixQrCodeBase64(data.qrCodeBase64);
      
      clearCart();
      setSuccess(true);
    } catch (error: any) {
      console.error("Erro ao finalizar compra:", error);
      alert(error.message || 'Erro ao processar pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Se o cliente não estiver logado nesta loja, convida para fazer login com usuário/senha ou cadastrar
  if (!customer || customer.storeId !== store.id) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 space-y-6">
          <div 
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white shadow-md"
            style={{ backgroundColor: themeColor }}
          >
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Identificação do Cliente
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Para finalizar seu pedido com total segurança na <strong className="text-slate-800 font-bold">{store.name}</strong>, faça login com seu usuário ou crie sua conta em 1 minuto.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to={`/${store.slug}/login`}
              state={{ from: `/${store.slug}/checkout` }}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center py-3.5 px-6 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md hover:opacity-95 transition-opacity"
              style={{ backgroundColor: themeColor }}
            >
              Já tenho Conta (Entrar)
            </Link>
            <Link
              to={`/${store.slug}/register`}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center py-3.5 px-6 border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Criar Nova Conta
            </Link>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Seus dados são protegidos e exclusivos desta loja</span>
          </div>
        </div>
      </div>
    );
  }

  // Pedido Realizado com Sucesso
  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center">
        <div className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200/80 shadow-2xl space-y-6">
          <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">{orderPaid ? 'Pagamento Aprovado! 🎉' : 'Pedido Confirmado!'}</h2>
            <p className="text-xs sm:text-sm text-slate-600">
              {orderPaid ? 'Seu pagamento foi confirmado com sucesso, ' : 'Obrigado pela sua compra, '}<strong className="text-slate-800">{customerName || customer.name}</strong>!
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
                O tempo para pagamento via PIX expirou e o pedido foi cancelado. Por favor, faça um novo pedido.
              </p>
            </div>
          )}

          {/* Instruções PIX */}
          {!orderPaid && !orderCancelled && (

            <div className="bg-emerald-50/70 border border-emerald-200/80 p-4 sm:p-6 rounded-2xl text-left space-y-3">
              
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



          <div className="pt-2">
            <Link
              to={`/${store.slug}`}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md hover:opacity-90 transition-opacity"
              style={{ backgroundColor: themeColor }}
            >
              Voltar à Loja
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
            
            {/* Identificação do Cliente Logado */}
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

            {/* Dados de Contato para o Pedido */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                Dados do Comprador
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
                  <input 
                    type="text" 
                    required 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp *</label>
                  <input 
                    type="text" 
                    required 
                    value={customerPhone} 
                    onChange={e => setCustomerPhone(maskPhone(e.target.value))} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-mail *</label>
                  <input 
                    type="email" 
                    required 
                    value={customerEmail} 
                    onChange={e => setCustomerEmail(e.target.value)} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CPF *</label>
                  <input 
                    type="text" 
                    required 
                    value={customerDoc} 
                    onChange={e => setCustomerDoc(maskCPF(e.target.value))} 
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono" 
                  />
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
                <li key={item.productId} className="py-2.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                      {item.quantity}x
                    </span>
                    <span className="text-slate-800 line-clamp-1 font-medium">{item.name}</span>
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
