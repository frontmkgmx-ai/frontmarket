import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Store, Product } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { ShoppingBag } from 'lucide-react';
import { FastCache } from '../../lib/cache';
import { withTimeout } from '../../lib/asyncGuard';
import { SmartLoader } from '../../components/SmartLoader';
import { ThemeConfig } from '../../lib/themes';

export function HomeStore() {
  const { store, currentTheme } = useOutletContext<{ store: Store; currentTheme: ThemeConfig }>();
  
  // Tenta carregar do cache instantâneo primeiro
  const [products, setProducts] = useState<Product[]>(() => {
    return store ? FastCache.get<Product[]>(`products_${store.id}`) || [] : [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return store ? !FastCache.get<Product[]>(`products_${store.id}`) : true;
  });

  const loadProducts = async () => {
    if (!store) return;
    try {
      // Query prioritária ordenada por data
      const q = query(
        collection(db, 'stores', store.id, 'products'),
        where('active', '==', true)
      );

      // Limita em 3.5 segundos para garantir que a interface nunca congele
      const snapshot = await withTimeout(
        getDocs(q),
        3500,
        undefined,
        'Busca de produtos demorou além do esperado.'
      );

      if (snapshot) {
        const items: Product[] = [];
        snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as Product));
        
        // Ordenação segura no client-side
        items.sort((a, b) => {
          const dateA = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const dateB = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return dateB - dateA;
        });

        setProducts(items);
        FastCache.set(`products_${store.id}`, items);
      }
    } catch (err: any) {
      console.warn("Aviso ao carregar produtos:", err.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [store?.id]);

  const loadingStyle = store?.settings?.loadingStyle || 'spinner';

  if (loading && products.length === 0) {
    return (
      <SmartLoader 
        message="Carregando produtos da vitrine..." 
        timeoutSeconds={3.5} 
        onRetry={loadProducts}
        fullScreen={false}
        styleType={loadingStyle}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Banner de Boas-vindas */}
      <div className="text-center py-8 sm:py-12 px-4 bg-slate-50 border border-slate-100 rounded-2xl sm:rounded-3xl shadow-2xs">
        <h1 className="text-2xl sm:text-4xl font-extrabold opacity-100 mb-2 sm:mb-3 tracking-tight">
          Bem-vindo(a) à {store.name}
        </h1>
        <p className="text-sm sm:text-base opacity-80 max-w-lg mx-auto">
          Confira nossos produtos em destaque e aproveite as melhores ofertas.
        </p>
      </div>

      {/* Cabeçalho da Seção */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <h2 className="text-lg sm:text-2xl font-bold opacity-100">Catálogo de Produtos</h2>
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {products.length} {products.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      {products.length === 0 ? (
        <div className={`text-center py-16 px-4 opacity-70 ${currentTheme.colors.surface} rounded-2xl border border-dashed ${currentTheme.colors.border}`}>
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <h3 className="text-base font-semibold mb-1">Nenhum produto disponível</h3>
          <p className="text-xs max-w-xs mx-auto">
            Esta loja ainda não possui produtos ativos disponíveis para venda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {products.map((product) => (
            <Link 
              key={product.id} 
              to={`/${store.slug}/p/${product.slug}`} 
              className={`group flex flex-col ${currentTheme.colors.surface} border ${currentTheme.colors.border} rounded-xl sm:rounded-2xl overflow-hidden hover:border-indigo-400 hover:shadow-md transition-all`}
            >
              <div className="aspect-square bg-slate-100 overflow-hidden relative">
                {product.images && product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="object-cover object-center w-full h-full group-hover:scale-103 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 opacity-60 text-xs font-medium">
                    Sem Imagem
                  </div>
                )}
                {product.isDigital && (
                  <span className="absolute top-2 left-2 bg-indigo-600/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    Digital
                  </span>
                )}
              </div>
              
              <div className="p-3 sm:p-4 flex flex-col flex-1">
                <h3 className="text-xs sm:text-sm font-semibold opacity-90 group-hover:text-indigo-600 line-clamp-2 transition-colors">
                  {product.name}
                </h3>
                <p className="mt-auto pt-2 text-sm sm:text-base font-bold opacity-100">
                  {formatCurrency(product.price)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
