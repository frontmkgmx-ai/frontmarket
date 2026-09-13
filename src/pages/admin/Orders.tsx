import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { Order, OrderStatus } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { 
  ShoppingBag, 
  Search, 
  Clock, 
  CheckCircle2, 
  Truck, 
  Package, 
  XCircle, 
  RotateCcw,
  Eye,
  X,
  Phone,
  Mail,
  MapPin,
  Banknote,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { FastCache } from '../../lib/cache';

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
  pending_verification: { label: 'Verificando Pgto', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Clock },
  paid: { label: 'Pago', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Banknote },
  processing: { label: 'Em Preparo', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Package },
  shipped: { label: 'Enviado', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: Truck },
  delivered: { label: 'Entregue', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: XCircle },
  refunded: { label: 'Reembolsado', color: 'bg-slate-100 text-slate-800 border-slate-200', icon: RotateCcw }
};

export function Orders() {
  const { activeStore } = useAuthStore();
  const cacheKey = activeStore?.id ? `orders_${activeStore.id}` : '';
  
  const [orders, setOrders] = useState<Order[]>(() => {
    return (cacheKey && FastCache.get(cacheKey)) || [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return cacheKey ? !FastCache.get(cacheKey) : true;
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  useEffect(() => {
    if (!activeStore?.id) {
      setLoading(false);
      return;
    }

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const q = query(
      collection(db, 'stores', activeStore.id, 'orders'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      clearTimeout(safetyTimer);
      const ordersData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Order[];
      setOrders(ordersData);
      if (cacheKey) FastCache.set(cacheKey, ordersData);
      setLoading(false);
    }, (error) => {
      clearTimeout(safetyTimer);
      console.warn("Aviso ao carregar pedidos:", error);
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [activeStore?.id, cacheKey]);


  const handleMisticSync = async (orderId: string) => {
    if (!activeStore) return;
    try {
      setUpdatingStatus(true);
      const res = await fetch('/api/checkout/misticpay/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: activeStore.id, orderId })
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


  const handleResendEmail = async (orderId: string, currentStatus: string) => {
    if (!activeStore) return;
    setResendingEmail(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/orders/${activeStore.id}/${orderId}/trigger-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: currentStatus })
      });
      if (res.ok) {
        alert('E-mail reenviado com sucesso!');
      } else {
        alert('Erro ao reenviar e-mail.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao reenviar e-mail');
    } finally {
      setResendingEmail(false);
    }
  };

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

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (!activeStore) return;
    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'stores', activeStore.id, 'orders', orderId), {
        status: newStatus
      });
      // Try to trigger email
      try {
        const token = await auth.currentUser?.getIdToken();
        await fetch(`/api/orders/${activeStore.id}/${orderId}/trigger-email`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: newStatus })
        });
      } catch (e) {
        console.error('Email trigger failed', e);
      }
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev: any) => ({ ...prev, status: newStatus }));
      }
      if (cacheKey) FastCache.invalidate(cacheKey);
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar status do pedido');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(search.toLowerCase()) ||
      ((order.customer?.name || (order as any).customerName) || '').toLowerCase().includes(search.toLowerCase()) ||
      ((order.customer?.email || (order as any).customerEmail) || '').toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header com HUD responsivo para Mobile & Desktop */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" />
            Gestão de Pedidos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Acompanhe vendas, status de entrega e pagamentos em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Sincronização em tempo real
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código, nome do cliente ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Filtros em Abas Roláveis em Mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'pending', label: 'Pendentes' },
            { id: 'processing', label: 'Em Preparo' },
            { id: 'shipped', label: 'Enviados' },
            { id: 'delivered', label: 'Entregues' },
            { id: 'cancelled', label: 'Cancelados' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Pedidos */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center">
          <div className="inline-block w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs sm:text-sm text-slate-500 mt-3">Carregando pedidos...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-2xs">
          <ShoppingBag className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Nenhum pedido encontrado</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {search || statusFilter !== 'all' 
              ? 'Nenhum pedido corresponde aos filtros aplicados.' 
              : 'Seus novos pedidos realizados pelos clientes na loja aparecerão aqui automaticamente.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {/* Tabela em Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Pedido</th>
                  <th className="py-3.5 px-5">Cliente</th>
                  <th className="py-3.5 px-5">Itens</th>
                  <th className="py-3.5 px-5">Total</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredOrders.map((order) => {
                  const statusInfo = statusConfig[order.status] || statusConfig.pending;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-indigo-600 text-xs">
                        #{order.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-slate-900">{order.customer?.name || (order as any).customerName || 'Cliente'}</div>
                        <div className="text-xs text-slate-400">{order.customer?.email || (order as any).customerEmail}</div>
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 text-xs">
                        {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'itens'}
                      </td>
                      <td className="py-3.5 px-5 font-bold text-slate-900">
                        {formatCurrency(order.total || 0)}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards em Mobile / Tablets */}
          <div className="lg:hidden divide-y divide-slate-100">
            {filteredOrders.map((order) => {
              const statusInfo = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = statusInfo.icon;
              return (
                <div key={order.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-indigo-600">
                      #{order.id.slice(-6).toUpperCase()}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusInfo.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </span>
                  </div>

                  <div>
                    <div className="text-xs sm:text-sm font-semibold text-slate-900">{order.customer?.name || (order as any).customerName || 'Cliente'}</div>
                    <div className="text-[11px] text-slate-500">{order.customer?.email || (order as any).customerEmail}</div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <span className="text-slate-500">{order.items?.length || 0} itens</span>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(order.total || 0)}</span>
                  </div>

                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver Detalhes do Pedido
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Pedido com HUD Adaptado */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                    Pedido #{selectedOrder.id.slice(-6).toUpperCase()}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig[selectedOrder.status as OrderStatus]?.color}`}>
                    {statusConfig[selectedOrder.status as OrderStatus]?.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Pagamento via PIX</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Alteração rápida de Status */}
              <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Atualizar Status do Pedido:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  
                  {(Object.keys(statusConfig) as OrderStatus[]).map((st) => {
                    const isManualAllowed = ['processing', 'shipped', 'delivered'].includes(st);
                    const canChangeNow = ['paid', 'processing', 'shipped', 'delivered'].includes(selectedOrder.status);
                    
                    const isDisabled = 
                      updatingStatus || 
                      selectedOrder.status === st || 
                      !isManualAllowed ||
                      !canChangeNow;

                    return (

                      <button
                        key={st}
                        disabled={isDisabled}
                        onClick={() => handleUpdateStatus(selectedOrder.id, st)}
                        className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${
                          selectedOrder.status === st
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                            : isDisabled
                            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer'
                        }`}
                      >
                        {statusConfig[st].label}
                      </button>
                    );
                  })}

                </div>
                
                
                {selectedOrder.status === 'pending' && (
                  <div className="mt-4 flex justify-end">
                    <button
                      disabled={updatingStatus}
                      onClick={() => handleMisticSync(selectedOrder.id)}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${updatingStatus ? 'animate-spin' : ''}`} />
                      Sincronizar Pagamento Mistic Pay
                    </button>
                  </div>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    disabled={resendingEmail}
                    onClick={() => handleResendEmail(selectedOrder.id, selectedOrder.status)}
                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Mail className={`w-4 h-4 ${resendingEmail ? 'animate-pulse' : ''}`} />
                    Reenviar E-mail
                  </button>
                  {selectedOrder.status === 'paid' && (
                    <button
                      disabled={updatingStatus}
                      onClick={() => handleRefund(selectedOrder.id)}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <RotateCcw className={`w-4 h-4 ${updatingStatus ? 'animate-spin' : ''}`} />
                      Solicitar Reembolso
                    </button>
                  )}
                </div>

              </div>

              {/* Dados do Cliente */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Cliente</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Nome</span>
                    <strong className="text-slate-800">{selectedOrder.customer?.name || (selectedOrder as any).customerName || 'Não informado'}</strong>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">E-mail</span>
                    <div className="flex items-center gap-1 text-slate-800 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {selectedOrder.customer?.email || (selectedOrder as any).customerEmail || 'Não informado'}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Telefone</span>
                    <div className="flex items-center gap-1 text-slate-800">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {selectedOrder.customer?.phone || (selectedOrder as any).customerPhone || 'Não informado'}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">CPF / Documento</span>
                    <div className="flex items-center gap-1 text-slate-800">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {selectedOrder.customer?.document || (selectedOrder as any).customerDocument || 'Não informado'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Endereço de Entrega */}
              {selectedOrder.shippingAddress && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Endereço de Entrega</h4>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-800">
                        {selectedOrder.shippingAddress.street}, Nº {selectedOrder.shippingAddress.number}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedOrder.shippingAddress.neighborhood} - {selectedOrder.shippingAddress.city}/{selectedOrder.shippingAddress.state} - CEP: {selectedOrder.shippingAddress.zipcode}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Itens do Pedido */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Produtos Comprados</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs sm:text-sm">
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <div key={idx} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-400">SKU: {item.sku || 'N/A'} • {item.quantity}x {formatCurrency(item.price)}</div>
                      </div>
                      <div className="font-bold text-slate-900">
                        {formatCurrency(item.price * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totais */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedOrder.subtotal || selectedOrder.total)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Frete:</span>
                  <span className="text-emerald-600 font-semibold">Grátis</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200 text-sm sm:text-base">
                  <span>Total:</span>
                  <span className="text-indigo-600">{formatCurrency(selectedOrder.total)}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
