import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { DollarSign, ShoppingBag, Users, Package, ExternalLink, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { Link } from 'react-router';

export function Dashboard() {
  const { activeStore } = useAuthStore();
  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalCustomers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeStore?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Escuta contagem de produtos em tempo real
    const productsRef = collection(db, 'stores', activeStore.id, 'products');
    const unsubProducts = onSnapshot(productsRef, (snap) => {
      setStats(prev => ({ ...prev, totalProducts: snap.size }));
      setLoading(false);
    }, (err) => {
      console.error("Products listener error:", err);
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
      setStats(prev => ({ 
        ...prev, 
        totalSales: sales, 
        totalOrders: snap.size 
      }));
    }, (err) => {
      console.error("Orders listener error:", err);
    });

    // 3. Escuta clientes em tempo real
    const customersRef = collection(db, 'stores', activeStore.id, 'customers');
    const unsubCustomers = onSnapshot(customersRef, (snap) => {
      setStats(prev => ({ ...prev, totalCustomers: snap.size }));
    }, (err) => {
      console.error("Customers listener error:", err);
    });

    return () => {
      unsubProducts();
      unsubOrders();
      unsubCustomers();
    };
  }, [activeStore?.id]);

  const statCards = [
    { name: 'Faturamento', value: formatCurrency(stats.totalSales), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { name: 'Pedidos', value: stats.totalOrders, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Produtos', value: stats.totalProducts, icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { name: 'Clientes', value: stats.totalCustomers, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded-md w-48 animate-pulse"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
              <Sparkles className="w-3 h-3 mr-1" /> Tempo Real
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Loja: <span className="font-semibold text-gray-700">{activeStore?.name}</span> ({activeStore?.slug})
          </p>
        </div>
        
        {activeStore?.slug && (
          <Link 
            to={`/${activeStore.slug}`} 
            target="_blank"
            className="inline-flex items-center justify-center px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all"
          >
            <span>Acessar Vitrine da Loja</span>
            <ExternalLink className="w-4 h-4 ml-2 text-gray-400" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {stats.totalOrders === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 sm:p-14 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Sua loja está online e pronta para vender!</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
            Adicione seus primeiros produtos no catálogo e compartilhe o link público da sua loja para receber pedidos.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/admin/products/new"
              className="inline-flex items-center px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <Package className="w-4 h-4 mr-2" />
              Cadastrar Primeiro Produto
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
