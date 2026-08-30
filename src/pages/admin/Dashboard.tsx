import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { DollarSign, ShoppingBag, Users, Package } from 'lucide-react';
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
    async function loadStats() {
      if (!activeStore) return;

      try {
        // In a real production app, we would use aggregations or Cloud Functions to calculate this.
        // For now, we'll fetch basic counts.
        
        // Products count
        const productsRef = collection(db, 'stores', activeStore.id, 'products');
        const productsCount = await getCountFromServer(productsRef);

        // Orders count & sales sum
        const ordersRef = collection(db, 'stores', activeStore.id, 'orders');
        const qOrders = query(ordersRef, where('status', '!=', 'cancelled'));
        const ordersSnap = await getDocs(qOrders);
        
        let sales = 0;
        ordersSnap.forEach((doc) => {
          sales += doc.data().total || 0;
        });

        // Customers count
        const customersRef = collection(db, 'stores', activeStore.id, 'customers');
        const customersCount = await getCountFromServer(customersRef);

        setStats({
          totalSales: sales,
          totalOrders: ordersSnap.size,
          totalProducts: productsCount.data().count,
          totalCustomers: customersCount.data().count
        });
      } catch (error) {
        console.error("Error loading stats", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [activeStore]);

  const statCards = [
    { name: 'Faturamento', value: formatCurrency(stats.totalSales), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100' },
    { name: 'Pedidos', value: stats.totalOrders, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-100' },
    { name: 'Produtos', value: stats.totalProducts, icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { name: 'Clientes', value: stats.totalCustomers, icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
  ];

  if (loading) {
    return (
      <div className="flex animate-pulse space-x-4">
        <div className="flex-1 space-y-4 py-1">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
          <p className="text-sm text-gray-500 mt-1">Acompanhe os resultados da sua loja</p>
        </div>
        <Link 
          to={`/${activeStore?.slug}`} 
          target="_blank"
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Ver Loja
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {stats.totalOrders === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ainda não existem vendas.</h3>
          <p className="text-gray-500">Sua loja está pronta. Divulgue o link para começar a vender!</p>
        </div>
      )}
    </div>
  );
}
