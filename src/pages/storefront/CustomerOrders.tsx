import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Store, Order } from '../../types';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  Truck, 
  XCircle, 
  ArrowLeft, 
  Loader2, 
  RotateCcw,
  ShoppingBag,
  ExternalLink,
  MapPin,
  CreditCard,
  User,
  ChevronRight,
  ShieldCheck,
  QrCode
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { CustomerProfileModal } from '../../components/CustomerProfileModal';

export function CustomerOrders() {
  const { store } = useOutletContext<{ store: Store }>();
  const { customer, loadCustomerSession } = useCustomerAuthStore();
  const navigate = useNavigate();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    loadCustomerSession(store.id);
  }, [store.id, loadCustomerSession]);

  useEffect(() => {
    if (!customer) {
      navigate(`/${store.slug}/login`);
      return;
    }

    const fetchOrders = async () => {
      try {
        const q = query(
          collection(db, 'stores', store.id, 'orders'),
          where('customerId', '==', customer.id),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
        setOrders(data);
      } catch (error) {
        console.error("Erro ao buscar pedidos:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [customer, store.id, store.slug, navigate]);

  const themeColor = store.settings?.themeColor || '#007AFF';

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending': 
        return { 
          label: 'Aguardando Pagamento', 
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/60', 
          dotClass: 'bg-amber-500',
          icon: Clock 
        };
      case 'pending_verification': 
        return { 
          label: 'Verificando Pagamento', 
          badgeClass: 'bg-orange-50 text-orange-700 border-orange-200/60', 
          dotClass: 'bg-orange-500',
          icon: Clock 
        };
      case 'paid': 
        return { 
          label: 'Pagamento Aprovado', 
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', 
          dotClass: 'bg-emerald-500',
          icon: CheckCircle2 
        };
      case 'processing': 
        return { 
          label: 'Em Preparação', 
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/60', 
          dotClass: 'bg-blue-500',
          icon: Package 
        };
      case 'shipped': 
        return { 
          label: 'Enviado / A Caminho', 
          badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/60', 
          dotClass: 'bg-indigo-500',
          icon: Truck 
        };
      case 'delivered': 
        return { 
          label: 'Entregue com Sucesso', 
          badgeClass: 'bg-teal-50 text-teal-700 border-teal-200/60', 
          dotClass: 'bg-teal-500',
          icon: CheckCircle2 
        };
      case 'cancelled': 
        return { 
          label: 'Cancelado', 
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/60', 
          dotClass: 'bg-rose-500',
          icon: XCircle 
        };
      case 'refunded': 
        return { 
          label: 'Reembolsado via Pix', 
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/60', 
          dotClass: 'bg-purple-500',
          icon: RotateCcw 
        };
      default: 
        return { 
          label: status, 
          badgeClass: 'bg-slate-50 text-slate-700 border-slate-200/60', 
          dotClass: 'bg-slate-500',
          icon: Package 
        };
    }
  };

  // Filtragem dos pedidos por aba
  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders;
    if (statusFilter === 'pending') {
      return orders.filter(o => o.status === 'pending' || o.status === 'pending_verification');
    }
    if (statusFilter === 'paid') {
      return orders.filter(o => o.status === 'paid' || o.status === 'processing');
    }
    if (statusFilter === 'shipped') {
      return orders.filter(o => o.status === 'shipped' || o.status === 'delivered');
    }
    if (statusFilter === 'cancelled') {
      return orders.filter(o => o.status === 'cancelled' || o.status === 'refunded');
    }
    return orders;
  }, [orders, statusFilter]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 flex flex-col items-center justify-center text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#007AFF]" />
        <p className="text-xs font-medium text-slate-500">Buscando histórico de compras...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-8 px-2 sm:px-4 space-y-6">
      {/* iOS Top Bar with Navigation & Profile Action */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link 
            to={`/${store.slug}`}
            className="w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-xs border border-black/[0.08] active:scale-95 transition-all"
            title="Voltar para a vitrine"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C1C1E]">
              Meus Pedidos
            </h1>
            <p className="text-xs text-slate-500">
              Histórico detalhado e status em tempo real
            </p>
          </div>
        </div>

        {/* Quick link to Edit Profile / Chave Pix */}
        <button
          onClick={() => setIsProfileModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-black/[0.08] shadow-xs text-xs font-semibold text-slate-700 hover:text-[#007AFF] active:scale-95 transition-all cursor-pointer"
          title="Abrir Meu Perfil"
        >
          <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center text-white text-[10px] font-bold">
            {customer?.avatarUrl ? (
              <img src={customer.avatarUrl} alt={customer.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: themeColor }}>
                {customer?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <span className="hidden sm:inline">Editar Perfil / Pix</span>
        </button>
      </div>

      {/* iOS Refund / Pix Protection Banner */}
      <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-black/[0.06] shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#1C1C1E] flex items-center gap-1.5">
              <span>Chave Pix de Reembolso:</span>
              <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                {customer?.pixKey ? customer.pixKey : 'Não cadastrada'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {customer?.pixKey 
                ? 'Em caso de estorno aprovado, o valor será creditado nesta chave.'
                : 'Cadastre sua Chave Pix para receber reembolsos instantâneos.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsProfileModalOpen(true)}
          className="text-xs font-semibold text-[#007AFF] hover:underline whitespace-nowrap cursor-pointer"
        >
          {customer?.pixKey ? 'Alterar' : 'Cadastrar'}
        </button>
      </div>

      {/* iOS Segmented Control for Order Filtering */}
      {orders.length > 0 && (
        <div className="flex items-center gap-1 p-1 bg-black/[0.04] rounded-2xl overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'Todos', count: orders.length },
            { id: 'pending', label: 'Pendentes', count: orders.filter(o => o.status === 'pending' || o.status === 'pending_verification').length },
            { id: 'paid', label: 'Aprovados', count: orders.filter(o => o.status === 'paid' || o.status === 'processing').length },
            { id: 'shipped', label: 'A Caminho / Entregues', count: orders.filter(o => o.status === 'shipped' || o.status === 'delivered').length },
            { id: 'cancelled', label: 'Cancelados', count: orders.filter(o => o.status === 'cancelled' || o.status === 'refunded').length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white text-[#1C1C1E] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full ${
                statusFilter === tab.id ? 'bg-slate-100 text-slate-700' : 'text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Orders List or Empty State */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-black/[0.06] p-8 sm:p-12 text-center shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
          <div className="w-16 h-16 bg-[#F2F2F7] rounded-full flex items-center justify-center mx-auto text-slate-400">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1C1C1E]">
              {statusFilter === 'all' ? 'Nenhum pedido realizado ainda' : 'Nenhum pedido nesta categoria'}
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
              Explore o catálogo da loja e faça seu primeiro pedido com total segurança.
            </p>
          </div>
          <Link
            to={`/${store.slug}`}
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-2xl text-white text-xs font-bold transition-transform active:scale-95 shadow-sm"
            style={{ backgroundColor: themeColor }}
          >
            Ver Produtos da Loja
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => {
            const statusInfo = getStatusDisplay(order.status);
            const StatusIcon = statusInfo.icon;
            
            return (
              <div 
                key={order.id} 
                className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_10px_rgba(0,0,0,0.04)] overflow-hidden transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
              >
                {/* Order iOS Card Header */}
                <div className="p-4 sm:p-5 bg-gradient-to-b from-slate-50/70 to-white border-b border-black/[0.05] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#1C1C1E]">
                        Pedido #{order.id.slice(-6).toUpperCase()}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        • {new Date(order.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* iOS Status Pill */}
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.badgeClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                    <StatusIcon className="w-3.5 h-3.5" />
                    <span>{statusInfo.label}</span>
                  </div>
                </div>

                {/* Items Grouped List */}
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="divide-y divide-black/[0.04]">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center font-bold text-slate-600 shrink-0 text-[10px]">
                            {item.quantity}x
                          </span>
                          <span className="font-medium text-[#1C1C1E] truncate">
                            {item.name}
                          </span>
                          {item.isDigital && (
                            <span className="text-[9px] bg-[#007AFF]/10 text-[#007AFF] px-1.5 py-0.5 rounded font-bold shrink-0">
                              Digital
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-slate-700 shrink-0 font-mono">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Shipping Address Preview if available */}
                  {order.shippingAddress && order.shippingAddress.street && (
                    <div className="p-3 bg-[#F2F2F7] rounded-xl border border-black/[0.04] text-[11px] text-slate-600 flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <div className="leading-tight">
                        <span className="font-semibold text-[#1C1C1E] block mb-0.5">Entrega em:</span>
                        <span>{order.shippingAddress.street}, {order.shippingAddress.number} {order.shippingAddress.complement ? `(${order.shippingAddress.complement})` : ''} - {order.shippingAddress.neighborhood}, {order.shippingAddress.city}/{order.shippingAddress.state}</span>
                      </div>
                    </div>
                  )}

                  {/* Totals & Quick Link */}
                  <div className="flex items-center justify-between pt-3 border-t border-black/[0.05]">
                    <div className="text-[11px] text-slate-500">
                      <span>Pagamento via </span>
                      <strong className="text-slate-700">Pix Instantâneo</strong>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Pago</span>
                      <span className="text-base sm:text-lg font-extrabold text-[#1C1C1E] tracking-tight">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer Profile Modal */}
      <CustomerProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        store={store}
      />
    </div>
  );
}
