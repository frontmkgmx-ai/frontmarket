import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { Product } from '../../types';
import { Trash2, Plus, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { formatCurrency } from '../../lib/utils';
import { FastCache } from '../../lib/cache';

export function Products() {
  const { activeStore } = useAuthStore();
  const cacheKey = activeStore?.id ? `admin_products_${activeStore.id}` : '';
  
  const [products, setProducts] = useState<Product[]>(() => {
    return (cacheKey && FastCache.get(cacheKey)) || [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return cacheKey ? !FastCache.get(cacheKey) : true;
  });

  useEffect(() => {
    if (!activeStore?.id) {
      setLoading(false);
      return;
    }

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const q = query(
      collection(db, 'stores', activeStore.id, 'products'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      clearTimeout(safetyTimer);
      const items: Product[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as Product));
      setProducts(items);
      if (cacheKey) FastCache.set(cacheKey, items);
      setLoading(false);
    }, (err) => {
      clearTimeout(safetyTimer);
      console.warn("Products listener warning:", err);
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [activeStore?.id, cacheKey]);

  const handleDelete = async (id: string) => {
    if (!activeStore || !window.confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      await deleteDoc(doc(db, 'stores', activeStore.id, 'products', id));
      FastCache.invalidate(`products_${activeStore.id}`);
      FastCache.invalidate(`admin_products_${activeStore.id}`);
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir produto');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Produtos</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="w-3 h-3 mr-1" /> Tempo Real
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Gerencie seu catálogo de produtos físicos e digitais</p>
        </div>
        <Link
          to="/admin/products/new"
          className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Produto
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="p-6 sm:p-8">
            <div className="animate-pulse flex flex-col space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 border-b border-slate-100 pb-4">
                  <div className="bg-slate-200 h-11 w-11 rounded-lg"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/5"></div>
                  </div>
                  <div className="h-4 bg-slate-200 rounded w-16"></div>
                  <div className="h-6 bg-slate-200 rounded-full w-14"></div>
                </div>
              ))}
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="p-10 sm:p-14 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
              <ImageIcon className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Nenhum produto cadastrado</h3>
            <p className="text-slate-500 text-xs mb-5 max-w-xs mx-auto">Você ainda não adicionou produtos ao catálogo da sua loja.</p>
            <Link
              to="/admin/products/new"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar Primeiro Produto
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Produto
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Preço
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Estoque
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 shrink-0 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200">
                          {product.images && product.images.length > 0 ? (
                            <img className="h-10 w-10 object-cover" src={product.images[0]} alt="" loading="lazy" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                        <div className="ml-3 min-w-0">
                          <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate max-w-[160px] sm:max-w-xs">{product.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">SKU: {product.sku || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs sm:text-sm font-semibold text-slate-900">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-600">
                      {product.isDigital ? (
                        <span className="text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md text-[11px]">Digital (∞)</span>
                      ) : (
                        `${product.stock} un`
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 inline-flex text-[10px] font-semibold rounded-full ${product.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {product.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right text-xs font-semibold">
                      <Link
                        to={`/admin/products/${product.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Editar
                      </Link>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-rose-500 hover:text-rose-700 inline-flex items-center cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
