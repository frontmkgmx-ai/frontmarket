import React, { useState, useEffect } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Store, Order } from '../../types';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { Package, Clock, CheckCircle2, Truck, XCircle, ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

export function CustomerOrders() {
  const { store } = useOutletContext<{ store: Store }>();
  const { customer, loadCustomerSession } = useCustomerAuthStore();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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

  const themeColor = store.settings?.themeColor || '#4f46e5';

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending': return { label: 'Aguardando Pagamento', color: 'bg-amber-100 text-amber-800', icon: Clock };
      case 'pending_verification': return { label: 'Verificando Pagamento', color: 'bg-orange-100 text-orange-800', icon: Clock };
      case 'paid': return { label: 'Pagamento Aprovado', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 };
      case 'processing': return { label: 'Em Preparo', color: 'bg-blue-100 text-blue-800', icon: Package };
      case 'shipped': return { label: 'Enviado', color: 'bg-indigo-100 text-indigo-800', icon: Truck };
      case 'delivered': return { label: 'Entregue', color: 'bg-teal-100 text-teal-800', icon: CheckCircle2 };
      case 'cancelled': return { label: 'Cancelado', color: 'bg-rose-100 text-rose-800', icon: XCircle };
      case 'refunded': return { label: 'Reembolsado', color: 'bg-slate-100 text-slate-800', icon: RotateCcw };
      default: return { label: status, color: 'bg-slate-100 text-slate-800', icon: Package };
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex items-center gap-4 mb-8">
        <Link 
          to={`/${store.slug}`}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 shadow-sm border border-slate-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meus Pedidos</h1>
          <p className="text-sm text-slate-500">Acompanhe o status das suas compras</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Nenhum pedido encontrado</h3>
          <p className="text-slate-500 mb-6 text-sm">Você ainda não realizou nenhuma compra nesta loja.</p>
          <Link
            to={`/${store.slug}`}
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-white font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: themeColor }}
          >
            Explorar Produtos
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const statusInfo = getStatusDisplay(order.status);
            const StatusIcon = statusInfo.icon;
            
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col sm:flex-row">
                <div className="p-5 sm:p-6 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="text-xs text-slate-500 font-medium mb-1">
                        Pedido #{order.id.slice(-6).toUpperCase()}
                      </div>
                      <div className="text-sm text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                    
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${statusInfo.color} w-fit`}>
                      <StatusIcon className="w-4 h-4" />
                      {statusInfo.label}
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-4">
                    <ul className="space-y-3 mb-4">
                      {order.items.map((item, idx) => (
                        <li key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700 font-medium">{item.quantity}x {item.name}</span>
                          <span className="text-slate-500">{formatCurrency(item.price * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="font-bold text-slate-900 text-lg">{formatCurrency(order.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
