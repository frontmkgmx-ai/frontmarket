import { useEffect, useState } from 'react';
import { useParams, useOutletContext, Link, useNavigate } from 'react-router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Store, Product } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { ArrowLeft, ShoppingCart, Check, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { FastCache } from '../../lib/cache';
import { withTimeout } from '../../lib/asyncGuard';
import { resolveStreamxImageUrl } from '../../lib/streamx';
import { SmartLoader } from '../../components/SmartLoader';
import { ThemeConfig } from '../../lib/themes';
import { AdvancedVideoPlayer } from '../../components/AdvancedVideoPlayer';
import { StreamxImage } from '../../components/StreamxImage';

export function ProductDetail() {
  const { store, currentTheme } = useOutletContext<{ store: Store; currentTheme: ThemeConfig }>();
  const { productSlug } = useParams<{ productSlug: string }>();
  
  // Tenta resolver o produto imediatamente a partir de múltiplos níveis de cache
  const initialCachedProduct = (): Product | null => {
    if (!store || !productSlug) return null;
    const cleanSlug = decodeURIComponent(productSlug).trim();
    const lowerSlug = cleanSlug.toLowerCase();

    // 1. Chave direta por slug ou ID
    const direct1 = FastCache.get<Product>(`prod_${store.id}_${cleanSlug}`);
    if (direct1) return direct1;
    const direct2 = FastCache.get<Product>(`prod_${store.slug}_${cleanSlug}`);
    if (direct2) return direct2;
    const direct3 = FastCache.get<Product>(`prod_${store.id}_${lowerSlug}`);
    if (direct3) return direct3;

    // 2. Busca na lista de produtos da loja em cache (carregada na vitrine)
    const list1 = FastCache.get<Product[]>(`products_${store.id}`);
    const list2 = FastCache.get<Product[]>(`products_${store.slug}`);
    const storeProducts = list1 || list2;

    if (storeProducts && Array.isArray(storeProducts)) {
      const match = storeProducts.find(p => 
        p.id === cleanSlug ||
        (p.slug && p.slug.trim().toLowerCase() === lowerSlug) ||
        (p.slug && p.slug === cleanSlug)
      );
      if (match) return match;
    }

    return null;
  };

  const [product, setProduct] = useState<Product | null>(initialCachedProduct);
  const [loading, setLoading] = useState<boolean>(() => !initialCachedProduct());
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);
  const navigate = useNavigate();
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const loadProduct = async () => {
    if (!store || !productSlug) return;
    setLoadError(null);

    const cleanSlug = decodeURIComponent(productSlug).trim();
    const lowerSlug = cleanSlug.toLowerCase();

    try {
      // TIER 1: API Segura e Instantânea do Servidor (~30ms, imune a problemas de rede/ad-blockers)
      try {
        const storeIdentifier = store.slug || store.id;
        const res = await fetch(`/api/public/stores/${encodeURIComponent(storeIdentifier)}/products/${encodeURIComponent(cleanSlug)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.product) {
            const foundProd = data.product as Product;
            setProduct(foundProd);
            FastCache.set(`prod_${store.id}_${cleanSlug}`, foundProd);
            FastCache.set(`prod_${store.id}_${foundProd.id}`, foundProd);
            if (foundProd.slug) {
              FastCache.set(`prod_${store.id}_${foundProd.slug}`, foundProd);
              FastCache.set(`prod_${store.slug}_${foundProd.slug}`, foundProd);
            }
            setLoading(false);
            return;
          }
        }
      } catch (apiErr) {
        console.warn("[ProductDetail] API pública temporariamente indisponível, tentando Firestore direto:", apiErr);
      }

      // TIER 2: Firestore direto no cliente com suporte a slug exato, minúsculas e ID
      const productsRef = collection(db, 'stores', store.id, 'products');

      // 2a. Busca por slug exato
      let q = query(productsRef, where('slug', '==', cleanSlug));
      let snapshot = await withTimeout(
        getDocs(q),
        8000,
        undefined,
        'Tempo limite ao buscar produto.'
      );

      // 2b. Busca por slug em minúsculas se diferir
      if ((!snapshot || snapshot.empty) && cleanSlug !== lowerSlug) {
        const qLower = query(productsRef, where('slug', '==', lowerSlug));
        snapshot = await withTimeout(getDocs(qLower), 4000, undefined, 'Tempo limite.');
      }

      // 2c. Se não encontrou por slug, busca por Document ID
      if (!snapshot || snapshot.empty) {
        try {
          const qId = query(productsRef, where('__name__', '==', cleanSlug));
          const idSnap = await getDocs(qId);
          if (!idSnap.empty) {
            snapshot = idSnap;
          }
        } catch (_) {}
      }

      // 2d. Fallback abrangente: obter produtos da loja e casar em memória
      if (!snapshot || snapshot.empty) {
        try {
          const allSnap = await getDocs(productsRef);
          const foundDoc = allSnap.docs.find(doc => {
            const d = doc.data();
            const s = (d.slug || '').trim().toLowerCase();
            return doc.id === cleanSlug || s === lowerSlug || s.replace(/[^a-z0-9]/g, '') === lowerSlug.replace(/[^a-z0-9]/g, '');
          });
          if (foundDoc) {
            const found = { id: foundDoc.id, ...foundDoc.data() } as Product;
            setProduct(found);
            FastCache.set(`prod_${store.id}_${cleanSlug}`, found);
            FastCache.set(`prod_${store.id}_${found.id}`, found);
            setLoading(false);
            return;
          }
        } catch (_) {}
      }

      if (snapshot && !snapshot.empty) {
        const found = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Product;
        setProduct(found);
        FastCache.set(`prod_${store.id}_${cleanSlug}`, found);
        FastCache.set(`prod_${store.id}_${found.id}`, found);
        if (found.slug) {
          FastCache.set(`prod_${store.id}_${found.slug}`, found);
          FastCache.set(`prod_${store.slug}_${found.slug}`, found);
        }
      } else if (!product) {
        setProduct(null);
      }
    } catch (err: any) {
      console.warn("Aviso ao carregar produto:", err.message || err);
      if (!product) {
        setLoadError(err.message || 'Falha na conexão ao carregar produto');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Se não tiver produto em cache, ou se o slug mudar, recarrega
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
        timeoutSeconds={10} 
        onRetry={() => { setLoading(true); loadProduct(); }}
        fullScreen={false}
      />
    );
  }

  if (!product) {
    return (
      <div className="text-center py-16 sm:py-24 max-w-md mx-auto px-4">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
          <RefreshCw className="w-6 h-6 stroke-[1.5]" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">
          {loadError ? 'Dificuldade ao carregar produto' : 'Produto não encontrado'}
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          {loadError 
            ? 'Não foi possível estabelecer conexão para carregar os dados. Por favor, tente novamente.'
            : 'O produto que você procura pode ter sido alterado ou removido pelo lojista.'}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            onClick={() => { setLoading(true); loadProduct(); }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar Novamente
          </button>
          <Link 
            to={`/${store.slug}`} 
            className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 bg-[#007AFF] hover:bg-[#0066CC] text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
          >
            Voltar para a vitrine
          </Link>
        </div>
      </div>
    );
  }

  const isOutOfStock = !product.isDigital && product.stock <= 0;
  const pdpStyle = store.settings?.pdpStyle || 'default';
  const themeColor = store.settings?.themeColor || '#4f46e5';

  const getContainerLayout = () => {
    switch (pdpStyle) {
      case 'centered':
        return 'flex flex-col items-center max-w-4xl mx-auto text-center';
      case 'compact':
        return 'grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 max-w-5xl mx-auto';
      case 'fullwidth':
        return 'grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 w-full max-w-none';
      case 'split':
        return 'grid grid-cols-1 lg:grid-cols-2 gap-0 border border-slate-200/80 rounded-3xl overflow-hidden bg-white shadow-sm';
      case 'modern':
        return 'grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 p-4 sm:p-8 bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/80 shadow-md';
      case 'minimalist':
        return 'grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 max-w-6xl mx-auto';
      case 'classic':
        return 'grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 p-6 bg-slate-50/50 rounded-2xl border-2 border-slate-200';
      case 'overlay':
        return 'grid grid-cols-1 lg:grid-cols-2 gap-8 relative';
      case 'gallery':
        return 'grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12';
      default:
        return 'grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start';
    }
  };

  return (
    <div className={`max-w-7xl mx-auto py-4 sm:py-8 px-2 sm:px-6 ${pdpStyle === 'minimalist' ? 'border-0' : ''}`}>
      <Link 
        to={`/${store.slug}`} 
        className="inline-flex items-center text-xs sm:text-sm font-semibold opacity-70 hover:opacity-100 mb-6 transition-opacity"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Voltar para a vitrine
      </Link>

      <div className={getContainerLayout()}>
        {/* Imagem / Video do Produto (Carrossel) */}
        <div className={`w-full ${pdpStyle === 'centered' ? 'max-w-md mb-6' : ''}`}>
          <div className={`aspect-video overflow-hidden bg-slate-100 border border-slate-200/80 shadow-xs relative group ${pdpStyle === 'split' ? 'rounded-none border-0' : 'rounded-2xl sm:rounded-3xl'}`}>
            {product.isDigital && (
              <span className="absolute top-3 left-3 bg-indigo-600/90 text-white text-xs font-bold px-2.5 py-1 rounded-lg backdrop-blur-xs z-20">
                Produto Digital
              </span>
            )}
            
            
            {(() => {
              const mediaItems: { type: 'image' | 'video', url: string }[] = [];
              if (product.images && product.images.length > 0) {
                product.images.forEach(img => {
                  if (!img) return; const isVideo = typeof img === 'string' && (img.includes('?type=video') || img.match(/\.(mp4|webm|ogg)$/i));
                  mediaItems.push({ type: isVideo ? 'video' : 'image', url: img });
                });
              }
              if (product.videoUrl) {
                mediaItems.push({ type: 'video', url: product.videoUrl });
              }

              
              if (mediaItems.length === 0) {
                return (
                  <div className="w-full h-full flex items-center justify-center opacity-60 text-sm font-medium">
                    Sem Imagem Cadastrada
                  </div>
                );
              }

              const handlePrev = () => {
                setCurrentMediaIndex(prev => prev === 0 ? mediaItems.length - 1 : prev - 1);
              };
              
              const handleNext = () => {
                setCurrentMediaIndex(prev => prev === mediaItems.length - 1 ? 0 : prev + 1);
              };


                  
                  

                  const minSwipeDistance = 50;

                  const onTouchStart = (e: any) => {
                    setTouchEnd(null);
                    setTouchStart(e.targetTouches[0].clientX);
                  };

                  const onTouchMove = (e: any) => {
                    setTouchEnd(e.targetTouches[0].clientX);
                  };

                  const onTouchEnd = () => {
                    if (!touchStart || !touchEnd) return;
                    const distance = touchStart - touchEnd;
                    const isLeftSwipe = distance > minSwipeDistance;
                    const isRightSwipe = distance < -minSwipeDistance;
                    
                    if (isLeftSwipe) {
                      handleNext();
                    } else if (isRightSwipe) {
                      handlePrev();
                    }
                  };


              return (
                <>
                  <div 
                    className="w-full h-full flex transition-transform duration-300 ease-in-out" 
                    style={{ transform: `translateX(-${currentMediaIndex * 100}%)` }}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                  >
                    {mediaItems.map((item, index) => (
                      <div key={index} className="w-full h-full flex-shrink-0 relative">
                        {item.type === 'image' ? (
                          <StreamxImage
                            src={item.url}
                            alt={`${product.name} ${index + 1}`}
                            className="w-full h-full object-cover object-center"
                          />
                        ) : (
                          <AdvancedVideoPlayer url={item.url} />
                        )}
                      </div>
                    ))}
                  </div>

                  {mediaItems.length > 1 && (
                    <>
                      <button 
                        onClick={handlePrev}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white text-slate-800 rounded-full flex items-center justify-center shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={handleNext}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white text-slate-800 rounded-full flex items-center justify-center shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                        {mediaItems.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentMediaIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-all ${currentMediaIndex === idx ? 'bg-indigo-600 w-4' : 'bg-white/60 hover:bg-white'}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>

          {/* Galeria de Miniaturas para estilo Gallery */}
          {pdpStyle === 'gallery' && product.images && product.images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentMediaIndex(idx)}
                  className={`w-20 aspect-video shrink-0 rounded-xl overflow-hidden border-2 transition-all ${currentMediaIndex === idx ? 'border-indigo-600 shadow-sm' : 'border-slate-200 opacity-60 hover:opacity-100'}`}
                >
                  <StreamxImage src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Informações e Compra */}
        <div className={`flex flex-col ${pdpStyle === 'split' ? 'p-6 sm:p-10 justify-center' : ''} ${pdpStyle === 'centered' ? 'w-full' : ''}`}>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight opacity-100 mb-2">
            {product.name}
          </h1>
          
          <div className={`flex items-baseline gap-3 mb-6 ${pdpStyle === 'centered' ? 'justify-center' : ''}`}>
            <span className="text-2xl sm:text-3xl font-black opacity-100" style={{ color: themeColor }}>
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

          {/* Botões de Ação */}
          <div className="space-y-3 pt-6 border-t border-slate-200/80">
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
              style={!isOutOfStock ? { backgroundColor: themeColor } : {}}
              className={`w-full flex items-center justify-center py-3.5 px-6 rounded-xl font-bold text-sm text-white transition-all cursor-pointer shadow-md active:scale-98
                ${isOutOfStock 
                  ? 'bg-slate-300 cursor-not-allowed' 
                  : 'hover:opacity-95 shadow-indigo-600/20'
                }`}
            >
              Comprar Agora
            </button>
          </div>

          {/* Metadados */}
          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs opacity-70">
            <div>
              <span className="font-semibold">SKU: </span>
              {product.sku || 'Automático'}
            </div>
            <div>
              <span className="font-semibold">Disponibilidade: </span>
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
