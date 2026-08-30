import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Store, Product } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { ShoppingBag } from 'lucide-react';

export function HomeStore() {
  const { store } = useOutletContext<{ store: Store }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      if (!store) return;
      try {
        const q = query(
          collection(db, 'stores', store.id, 'products'),
          where('active', '==', true),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const items: Product[] = [];
        snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as Product));
        setProducts(items);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [store]);

  if (loading) {
    return <div className="text-center py-12">Carregando loja...</div>;
  }

  return (
    <div>
      <div className="text-center py-12 mb-12 bg-gray-50 rounded-2xl">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Bem-vindo(a) à {store.name}</h1>
        <p className="text-xl text-gray-600">Confira nossos produtos em destaque</p>
      </div>

      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Novidades</h2>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg">Esta loja ainda não possui produtos ativos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
          {products.map((product) => (
            <Link key={product.id} to={`/${store.slug}/p/${product.slug}`} className="group relative">
              <div className="aspect-w-4 aspect-h-3 bg-gray-100 rounded-xl overflow-hidden mb-4">
                {product.images && product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="object-cover object-center w-full h-full group-hover:opacity-75 transition-opacity"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                    Sem Imagem
                  </div>
                )}
              </div>
              <h3 className="text-sm text-gray-700 font-medium">{product.name}</h3>
              <p className="mt-1 text-lg font-bold text-gray-900">
                {formatCurrency(product.price)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
