import { useEffect, useState } from 'react';
import { useParams, useOutletContext, Link, useNavigate } from 'react-router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Store, Product } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { ArrowLeft, ShoppingCart, Check } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';

export function ProductDetail() {
  const { store } = useOutletContext<{ store: Store }>();
  const { productSlug } = useParams<{ productSlug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadProduct() {
      if (!store || !productSlug) return;
      try {
        const q = query(
          collection(db, 'stores', store.id, 'products'),
          where('slug', '==', productSlug)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setProduct({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Product);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [store, productSlug]);

  const handleAddToCart = () => {
    if (product) {
      addItem(product);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  };

  const handleBuyNow = () => {
    if (product) {
      addItem(product);
      navigate(`/${store.slug}/cart`);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Carregando produto...</div>;
  }

  if (!product) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-lg mb-4">Produto não encontrado.</p>
        <Link to={`/${store.slug}`} className="text-indigo-600 font-medium hover:underline">
          Voltar para a loja
        </Link>
      </div>
    );
  }

  const isOutOfStock = !product.isDigital && product.stock <= 0;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <Link to={`/${store.slug}`} className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-8">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </Link>

      <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16">
        {/* Imagem */}
        <div className="mb-10 lg:mb-0">
          <div className="aspect-w-1 aspect-h-1 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
            {product.images && product.images.length > 0 ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                Sem Imagem
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">
            {product.name}
          </h1>
          <p className="text-2xl font-bold text-gray-900 mb-6">
            {formatCurrency(product.price)}
          </p>

          <div className="prose prose-sm text-gray-600 mb-8">
            <p>{product.description}</p>
          </div>

          <div className="mt-auto space-y-4 pt-8 border-t border-gray-100">
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className={`w-full flex items-center justify-center py-3 px-8 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors
                ${isOutOfStock 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : added 
                    ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 focus:ring-indigo-500'
                }`}
            >
              {added ? (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Adicionado
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {isOutOfStock ? 'Esgotado' : 'Adicionar ao carrinho'}
                </>
              )}
            </button>

            <button
              onClick={handleBuyNow}
              disabled={isOutOfStock}
              className={`w-full flex items-center justify-center py-3 px-8 border border-transparent rounded-xl shadow-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors
                ${isOutOfStock 
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                }`}
            >
              Comprar agora
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-center text-sm text-gray-500">
              <span className="font-medium mr-2">SKU:</span>
              {product.sku || 'N/A'}
            </div>
            {!product.isDigital && (
              <div className="flex items-center text-sm text-gray-500 mt-2">
                <span className="font-medium mr-2">Disponibilidade:</span>
                {product.stock > 0 ? `${product.stock} em estoque` : 'Esgotado'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
