import { useState } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router';
import { collection, addDoc, serverTimestamp, doc, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Store, OrderItem } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { CheckCircle, ArrowLeft } from 'lucide-react';

export function Checkout() {
  const { store } = useOutletContext<{ store: Store }>();
  const { items, getTotal, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerDoc, setCustomerDoc] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  const [zipcode, setZipcode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const total = getTotal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || !store || !user) return;
    setLoading(true);

    try {
      const orderData = {
        storeId: store.id,
        customerId: user.uid,
        items,
        subtotal: total,
        shipping: 0,
        discount: 0,
        total,
        status: 'pending',
        customer: {
          name: customerName,
          email: customerEmail,
          document: customerDoc,
          phone: customerPhone
        },
        shippingAddress: {
          zipcode,
          street,
          number,
          neighborhood,
          city,
          state
        },
        paymentMethod: 'pix', // Mocked for now
        createdAt: serverTimestamp()
      };

      const orderRef = await addDoc(collection(db, 'stores', store.id, 'orders'), orderData);
      
      setOrderId(orderRef.id);
      clearCart();
      setSuccess(true);
    } catch (error) {
      console.error(error);
      alert('Erro ao processar pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Identificação Necessária</h2>
        <p className="text-lg text-gray-600 mb-8">Para finalizar sua compra e processarmos seu pedido, você precisa criar uma conta ou fazer login.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to={`/${store.slug}/register`}
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Criar Conta
          </Link>
          <Link
            to={`/${store.slug}/login`}
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50"
          >
            Fazer Login
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Pedido Realizado!</h2>
        <p className="text-lg text-gray-600 mb-2">Obrigado por comprar conosco, {customerName}.</p>
        <p className="text-gray-500 mb-8">O número do seu pedido é: <strong className="text-gray-900">#{orderId.slice(-6).toUpperCase()}</strong></p>
        <Link
          to={`/${store.slug}`}
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Voltar para a loja
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    navigate(`/${store.slug}/cart`);
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <Link to={`/${store.slug}/cart`} className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-8">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar ao carrinho
      </Link>

      <div className="lg:grid lg:grid-cols-12 lg:gap-x-12 lg:items-start">
        <div className="lg:col-span-7">
          <form id="checkout-form" onSubmit={handleSubmit} className="space-y-8">
            
            {/* Dados Pessoais */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Dados Pessoais</h2>
              <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Nome completo</label>
                  <input type="text" required value={customerName} onChange={e=>setCustomerName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 border shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input type="email" required value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 border shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">CPF/CNPJ</label>
                  <input type="text" required value={customerDoc} onChange={e=>setCustomerDoc(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 border shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Telefone</label>
                  <input type="text" required value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 border shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="pt-8 border-t border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Endereço de Entrega</h2>
              <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-6 sm:gap-x-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">CEP</label>
                  <input type="text" required value={zipcode} onChange={e=>setZipcode(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 border shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-sm font-medium text-gray-700">Rua</label>
                  <input type="text" required value={street} onChange={e=>setStreet(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 border shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Número</label>
                  <input type="text" required value={number} onChange={e=>setNumber(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 border shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-sm font-medium text-gray-700">Bairro</label>
                  <input type="text" required value={neighborhood} onChange={e=>setNeighborhood(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 border shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700">Cidade</label>
                  <input type="text" required value={city} onChange={e=>setCity(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 border shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700">Estado (UF)</label>
                  <input type="text" required value={state} onChange={e=>setState(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 border shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Resumo */}
        <div className="mt-10 lg:mt-0 lg:col-span-5">
          <div className="bg-gray-50 rounded-2xl px-4 py-6 sm:p-6 lg:p-8 sticky top-24">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Resumo do Pedido</h2>
            
            <ul className="divide-y divide-gray-200 border-t border-b border-gray-200 mb-6">
              {items.map((item) => (
                <li key={item.productId} className="py-4 flex justify-between">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900">{item.quantity}x</span>
                    <span className="ml-3 text-sm text-gray-600 line-clamp-1">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 ml-4">{formatCurrency(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>

            <dl className="space-y-4 text-sm text-gray-600 mb-6">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="font-medium text-gray-900">{formatCurrency(total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Frete</dt>
                <dd className="font-medium text-gray-900">Grátis</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-4">
                <dt className="text-base font-bold text-gray-900">Total</dt>
                <dd className="text-base font-bold text-indigo-600">{formatCurrency(total)}</dd>
              </div>
            </dl>

            <button
              type="submit"
              form="checkout-form"
              disabled={loading}
              className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Processando...' : 'Confirmar Pedido (PIX)'}
            </button>
            <p className="text-xs text-gray-500 text-center mt-4">
              Ambiente seguro. Ao finalizar, você receberá a chave PIX para pagamento.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

