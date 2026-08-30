import { useEffect, useState } from 'react';
import { useParams, useOutletContext, Link, useNavigate } from 'react-router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Store, Product } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { ArrowLeft, ShoppingCart, Check, RefreshCw } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { FastCache } from '../../lib/cache';
import { withTimeout } from '../../lib/asyncGuard';
import { SmartLoader } from '../../components/SmartLoader';
import { ThemeConfig } from '../../lib/themes';

export function ProductDetail() {
  const { store, currentTheme } = useOutletContext<{ store: Store; currentTheme: ThemeConfig }>();
  const { productSlug } = useParams<{ productSlug: string }>();
  
  const cacheKey = store && productSlug ? `prod_${store.id}_${productSlug}` : '';
  const [product, setProduct] = useState<Product | null>(() => {
    return cacheKey ? FastCache.get<Product>(cacheKey) : null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return cacheKey ? !FastCache.get<Product>(cacheKey) : true;
  });
  
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);
  const navigate = useNavigate();

  const loadProduct = async () => {
    if (!store || !productSlug) return;
    try {
      const q = query(
        collection(db, 'stores', store.id, 'products'),
        where('slug', '==', productSlug)
      );

      const snapshot = await withTimeout(
        getDocs(q),
        3500,
        undefined,
        'Busca do produto demorou além do esperado.'
      );

      if (snapshot && !snapshot.empty) {
        const found = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Product;
        setProduct(found);
        if (cacheKey) FastCache.set(cacheKey, found);
      } else if (!product) {
        setProduct(null);
      }
    } catch (err: any) {
      console.warn("Aviso ao carregar produto:", err.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [store?.id, productSlug]);

  // Dinamicamente injeta e atualiza tags Open Graph e Twitter Card para compartilhamento social
  useEffect(() => {
    if (product) {
      const originalTitle = document.title;
      const storeName = store?.name || 'Vitrine';
      const pageTitle = `${product.name} | ${storeName}`;
      document.title = pageTitle;

      const setMetaTag = (attrName: string, attrValue: string, content: string, isName = false) => {
        const selector = `meta[${isName ? 'name' : 'property'}="${attrName}"]`;
        let element = document.querySelector(selector);
        if (!element) {
          element = document.createElement('meta');
          element.setAttribute(isName ? 'name' : 'property', attrName);
          document.head.appendChild(element);
        }
        element.setAttribute('content', content);
      };

      const productImage = product.images?.[0] || '';
      const productUrl = typeof window !== 'undefined' ? window.location.href : '';
      const productDescription = product.description || `Compre ${product.name} por ${formatCurrency(product.price)} na ${storeName}.`;

      setMetaTag('og:title', '', pageTitle);
      setMetaTag('og:description', '', productDescription);
      if (productImage) {
        setMetaTag('og:image', '', productImage);
      }
      setMetaTag('og:url', '', productUrl);
      setMetaTag('og:type', '', 'product');

      setMetaTag('twitter:card', '', 'summary_large_image', true);
      setMetaTag('twitter:title', '', pageTitle, true);
      setMetaTag('twitter:description', '', productDescription, true);
      if (productImage) {
        setMetaTag('twitter:image', '', productImage, true);
      }

      return () => {
        document.title = originalTitle;
      };
    }
  }, [product, store]);

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

  if (loading && !product) {
    return (
      <SmartLoader 
        message="Carregando detalhes do produto..." 
        timeoutSeconds={3.5} 
        onRetry={loadProduct}
        fullScreen={false}
      />
    );
  }

  if (!product) {
    return (
      <div className="text-center py-16 sm:py-24 max-w-md mx-auto px-4">
        <h2 className="text-lg font-bold text-slate-800 mb-2">Produto não encontrado</h2>
        <p className="text-xs text-slate-500 mb-6">
          O produto que você procura pode ter sido alterado ou removido pelo lojista.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            onClick={() => { setLoading(true); loadProduct(); }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-opacity-10 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar Novamente
          </button>
          <Link 
            to={`/${store.slug}`} 
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Voltar para o catálogo
          </Link>
        </div>
      </div>
    );
  }

  const isOutOfStock = !product.isDigital && product.stock <= 0;

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-8 px-2 sm:px-6">
      <Link 
        to={`/${store.slug}`} 
        className="inline-flex items-center text-xs sm:text-sm font-semibold text-slate-500 hover:opacity-100 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Voltar para a vitrine
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        {/* Imagem do Produto */}
        <div className="w-full">
          <div className="aspect-square rounded-2xl sm:rounded-3xl overflow-hidden bg-opacity-10 border border-slate-200/80 shadow-xs relative">
            {product.images && product.images.length > 0 ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center opacity-60 text-sm font-medium">
                Sem Imagem Cadastrada
              </div>
            )}
            {product.isDigital && (
              <span className="absolute top-3 left-3 bg-indigo-600/90 text-white text-xs font-bold px-2.5 py-1 rounded-lg backdrop-blur-xs">
                Produto Digital
              </span>
            )}
          </div>
        </div>

        {/* Informações e Compra */}
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight opacity-100 mb-2">
            {product.name}
          </h1>
          
          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-2xl sm:text-3xl font-black opacity-100">
              {formatCurrency(product.price)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-sm sm:text-base opacity-60 line-through">
                {formatCurrency(product.compareAtPrice)}
              </span>
            )}
          </div>

          <div className="prose prose-sm opacity-80 mb-8 max-w-none">
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2">Descrição</h4>
            <p className="whitespace-pre-line leading-relaxed text-sm">
              {product.description || 'Sem descrição detalhada para este item.'}
            </p>
          </div>

          {product.videoUrl && (
            <div className="mb-8">
              <h4 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2">Vídeo do Produto</h4>
              <div className="aspect-video rounded-xl overflow-hidden bg-opacity-10 border border-slate-200">
                {product.videoUrl.includes('youtube.com') || product.videoUrl.includes('youtu.be') ? (
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${
                      product.videoUrl.includes('youtu.be') 
                        ? product.videoUrl.split('youtu.be/')[1].split('?')[0] 
                        : product.videoUrl.split('v=')[1]?.split('&')[0] || ''
                    }`}
                    title="Vídeo do Produto"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video controls className="w-full h-full object-cover">
                    <source src={product.videoUrl} />
                    Seu navegador não suporta vídeos.
                  </video>
                )}
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="space-y-3 pt-6 border-t border-slate-200">
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className={`w-full flex items-center justify-center py-3.5 px-6 rounded-xl font-semibold text-sm transition-all cursor-pointer shadow-xs active:scale-98
                ${isOutOfStock 
                  ? 'bg-opacity-10 opacity-60 cursor-not-allowed border border-slate-200' 
                  : added 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                }`}
            >
              {added ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Item Adicionado ao Carrinho!
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {isOutOfStock ? 'Produto Esgotado' : 'Adicionar ao Carrinho'}
                </>
              )}
            </button>

            <button
              onClick={handleBuyNow}
              disabled={isOutOfStock}
              className={`w-full flex items-center justify-center py-3.5 px-6 rounded-xl font-bold text-sm text-white transition-all cursor-pointer shadow-md active:scale-98
                ${isOutOfStock 
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-600/20'
                }`}
            >
              Comprar Agora
            </button>
          </div>

          {/* Metadados */}
          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs text-slate-500">
            <div>
              <span className="font-semibold text-slate-700">SKU: </span>
              {product.sku || 'Automático'}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Disponibilidade: </span>
              {product.isDigital ? (
                <span className="text-emerald-600 font-semibold">Envio Imediato</span>
              ) : product.stock > 0 ? (
                <span className="text-emerald-600 font-semibold">{product.stock} un disponíveis</span>
              ) : (
                <span className="text-rose-600 font-semibold">Esgotado</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
