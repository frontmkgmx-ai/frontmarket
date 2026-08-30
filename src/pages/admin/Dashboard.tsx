import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { DollarSign, ShoppingBag, Users, Package, ExternalLink, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { Link } from 'react-router';
import { FastCache } from '../../lib/cache';

export function Dashboard() {
  const { activeStore } = useAuthStore();
  const cacheKey = activeStore?.id ? `dash_stats_${activeStore.id}` : '';
  
  const [stats, setStats] = useState(() => {
    return (cacheKey && FastCache.get(cacheKey)) || {
      totalSales: 0,
      totalOrders: 0,
      totalProducts: 0,
      totalCustomers: 0
    };
  });
  
  const [loading, setLoading] = useState<boolean>(() => {
    return cacheKey ? !FastCache.get(cacheKey) : true;
  });

  useEffect(() => {
    if (!activeStore?.id) {
      setLoading(false);
      return;
    }

    // Trava de segurança anti-loading infinito (2.5s máximo)
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    // 1. Escuta contagem de produtos em tempo real
    const productsRef = collection(db, 'stores', activeStore.id, 'products');
    const unsubProducts = onSnapshot(productsRef, (snap) => {
      setStats(prev => {
        const next = { ...prev, totalProducts: snap.size };
        if (cacheKey) FastCache.set(cacheKey, next);
        return next;
      });
      setLoading(false);
      clearTimeout(safetyTimer);
    }, (err) => {
      console.warn("Products listener warning:", err);
      setLoading(false);
    });

    // 2. Escuta pedidos e faturamento em tempo real
    const ordersRef = collection(db, 'stores', activeStore.id, 'orders');
    const qOrders = query(ordersRef, where('status', '!=', 'cancelled'));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      let sales = 0;
      snap.forEach((doc) => {
        sales += doc.data().total || 0;
      });
      setStats(prev => {
        const next = { ...prev, totalSales: sales, totalOrders: snap.size };
        if (cacheKey) FastCache.set(cacheKey, next);
        return next;
      });
    }, (err) => {
      console.warn("Orders listener warning:", err);
    });

    // 3. Escuta clientes em tempo real
    const customersRef = collection(db, 'stores', activeStore.id, 'customers');
    const unsubCustomers = onSnapshot(customersRef, (snap) => {
      setStats(prev => {
        const next = { ...prev, totalCustomers: snap.size };
        if (cacheKey) FastCache.set(cacheKey, next);
        return next;
      });
    }, (err) => {
      console.warn("Customers listener warning:", err);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubProducts();
      unsubOrders();
      unsubCustomers();
    };
  }, [activeStore?.id, cacheKey]);

  const statCards = [
    { name: 'Faturamento', value: formatCurrency(stats.totalSales), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { name: 'Pedidos', value: stats.totalOrders, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Produtos', value: stats.totalProducts, icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { name: 'Clientes', value: stats.totalCustomers, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded-md w-48"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-slate-100 p-5">
              <div className="h-3.5 bg-slate-200 rounded w-20 mb-3"></div>
              <div className="h-7 bg-slate-200 rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Visão Geral</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="w-3 h-3 mr-1" /> Tempo Real
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Loja: <span className="font-semibold text-slate-700">{activeStore?.name}</span> ({activeStore?.slug})
          </p>
        </div>
        
        {activeStore?.slug && (
          <Link 
            to={`/${activeStore.slug}`} 
            target="_blank"
            className="inline-flex items-center justify-center px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-all"
          >
            <span>Acessar Vitrine</span>
            <ExternalLink className="w-3.5 h-3.5 ml-2 text-slate-400" />
          </Link>
        )}
      </div>

      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl border border-teal-100 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center gap-4 sm:gap-6 justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shrink-0 border border-teal-200 shadow-sm">
            <Sparkles className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h3 className="font-bold text-teal-900">Segurança da Loja (KYC)</h3>
            <p className="text-xs text-teal-700 mt-0.5">
              Valide sua identidade via Didit para obter o selo de loja verificada e aumentar sua credibilidade.
            </p>
          </div>
        </div>
        <Link 
          to="/admin/verification" 
          className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm whitespace-nowrap"
        >
          Verificar Agora
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{stat.name}</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {stats.totalOrders === 0 && stats.totalProducts === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 sm:p-12 text-center max-w-xl mx-auto shadow-2xs">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-600">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">Sua loja está online e pronta!</h3>
          <p className="text-slate-500 text-xs sm:text-sm max-w-sm mx-auto mb-5 leading-relaxed">
            Adicione seus primeiros produtos no catálogo e compartilhe o link público para receber pedidos.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/admin/products/new"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-xs transition-colors"
            >
              <Package className="w-4 h-4 mr-1.5" />
              Cadastrar Primeiro Produto
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
