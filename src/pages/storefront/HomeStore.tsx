import { useEffect, useState, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Store, Product, Category } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { 
  ShoppingBag, 
  Search, 
  Tag, 
  Layers, 
  CheckCircle2, 
  Zap, 
  Sparkles, 
  ChevronRight, 
  ArrowRight,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { FastCache } from '../../lib/cache';
import { withTimeout } from '../../lib/asyncGuard';
import { SmartLoader } from '../../components/SmartLoader';
import { ThemeConfig } from '../../lib/themes';
import { StreamxImage } from '../../components/StreamxImage';

export function HomeStore() {
  const { store, currentTheme, openProfile } = useOutletContext<{ 
    store: Store; 
    currentTheme: ThemeConfig;
    openProfile?: () => void;
  }>();
  
  // Tenta carregar do cache instantâneo primeiro
  const [products, setProducts] = useState<Product[]>(() => {
    return store ? FastCache.get<Product[]>(`products_${store.id}`) || [] : [];
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    return store ? FastCache.get<Category[]>(`categories_${store.id}`) || [] : [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return store ? !FastCache.get<Product[]>(`products_${store.id}`) : true;
  });

  // Filtros de Categoria e Pesquisa
  const [selectedCategory, setSelectedCategory] = useState<string>('all'); // 'all' | category.id | 'uncategorized'
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadStoreData = async () => {
    if (!store) return;
    try {
      // 1. Carrega Produtos Ativos
      const qProducts = query(
        collection(db, 'stores', store.id, 'products'),
        where('active', '==', true)
      );

      // 2. Carrega Categorias Ativas
      const qCategories = query(
        collection(db, 'stores', store.id, 'categories'),
        where('active', '==', true)
      );

      const [productsSnap, categoriesSnap] = await Promise.all([
        withTimeout(getDocs(qProducts), 3500, undefined, 'Busca de produtos demorou além do esperado.'),
        withTimeout(getDocs(qCategories), 3500, undefined, 'Busca de categorias demorou além do esperado.')
      ]);

      if (productsSnap) {
        const items: Product[] = [];
        productsSnap.forEach(doc => items.push({ id: doc.id, ...doc.data() } as Product));
        
        items.sort((a, b) => {
          const dateA = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const dateB = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return dateB - dateA;
        });

        setProducts(items);
        FastCache.set(`products_${store.id}`, items);
      }

      if (categoriesSnap) {
        const cats: Category[] = [];
        categoriesSnap.forEach(doc => cats.push({ id: doc.id, ...doc.data() } as Category));
        cats.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setCategories(cats);
        FastCache.set(`categories_${store.id}`, cats);
      }
    } catch (err: any) {
      console.warn("Aviso ao carregar produtos/categorias:", err.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStoreData();
  }, [store?.id]);

  // Contagem de produtos sem categoria
  const uncategorizedCount = useMemo(() => {
    return products.filter(p => !p.categoryId || p.categoryId === 'none' || p.categoryId === '').length;
  }, [products]);

  // Contagem por categoria
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      if (p.categoryId) {
        counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Produtos filtrados por categoria e termo de busca
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Filtro de categoria
      if (selectedCategory === 'all') {
        // Mostra todos
      } else if (selectedCategory === 'uncategorized') {
        if (product.categoryId && product.categoryId !== 'none' && product.categoryId !== '') {
          return false;
        }
      } else {
        if (product.categoryId !== selectedCategory) {
          return false;
        }
      }

      // Filtro de busca
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const matchesName = product.name?.toLowerCase().includes(queryLower);
        const matchesDesc = product.description?.toLowerCase().includes(queryLower);
        const matchesSku = product.sku?.toLowerCase().includes(queryLower);
        if (!matchesName && !matchesDesc && !matchesSku) return false;
      }

      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  const loadingStyle = store?.settings?.loadingStyle || 'spinner';
  const themeColor = store?.settings?.themeColor || '#007AFF';

  if (loading && products.length === 0) {
    return (
      <SmartLoader 
        message="Carregando catálogo da loja..." 
        timeoutSeconds={3.5} 
        onRetry={loadStoreData}
        fullScreen={false}
        styleType={loadingStyle}
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Apple iOS Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-white to-slate-50 border border-black/[0.06] p-6 sm:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-center">
        {/* Ambient iOS glass glow */}
        <div 
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: themeColor }}
        />

        <div className="relative z-10 max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/[0.04] text-[11px] font-semibold text-slate-700 tracking-wide">
            <Sparkles className="w-3 h-3 text-[#007AFF]" />
            <span>Loja Oficial Verificada</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#1C1C1E]">
            {store.name}
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Produtos exclusivos com pagamento instantâneo via Pix, entrega rápida e garantia total de devolução.
          </p>
        </div>
      </section>

      {/* iOS Search Bar & Filter HUD */}
      <div className="space-y-3">
        {/* iOS Search Field */}
        <div className="relative max-w-xl mx-auto">
          <div className="relative flex items-center bg-black/[0.04] hover:bg-black/[0.06] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#007AFF] focus-within:shadow-sm rounded-2xl transition-all border border-black/[0.05]">
            <Search className="w-4 h-4 text-slate-400 ml-3.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produtos, marcas ou especificações..."
              className="w-full bg-transparent px-3 py-2.5 sm:py-3 text-xs sm:text-sm text-[#1C1C1E] placeholder:text-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="w-5 h-5 rounded-full bg-black/[0.1] hover:bg-black/[0.2] text-slate-600 flex items-center justify-center mr-3 transition-colors cursor-pointer"
                title="Limpar busca"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* iOS Category Segmented Pill Bar */}
        <div className="pt-2">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-2 px-1">
            {/* Categoria Geral / Todos */}
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer select-none active:scale-95 ${
                selectedCategory === 'all'
                  ? 'text-white shadow-sm'
                  : 'bg-white/80 hover:bg-white text-slate-600 border border-black/[0.06]'
              }`}
              style={selectedCategory === 'all' ? { backgroundColor: themeColor } : {}}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Geral (Todos)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {products.length}
              </span>
            </button>

            {/* Categorias cadastradas pelo vendedor */}
            {categories.map((cat) => {
              const count = categoryCounts[cat.id] || 0;
              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer select-none active:scale-95 ${
                    isSelected
                      ? 'text-white shadow-sm'
                      : 'bg-white/80 hover:bg-white text-slate-600 border border-black/[0.06]'
                  }`}
                  style={isSelected ? { backgroundColor: themeColor } : {}}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>{cat.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Categoria: Produtos Sem Categoria (se houver) */}
            {uncategorizedCount > 0 && (
              <button
                onClick={() => setSelectedCategory('uncategorized')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer select-none active:scale-95 ${
                  selectedCategory === 'uncategorized'
                    ? 'text-white shadow-sm'
                    : 'bg-white/80 hover:bg-white text-slate-600 border border-black/[0.06]'
                }`}
                style={selectedCategory === 'uncategorized' ? { backgroundColor: themeColor } : {}}
              >
                <span>Sem Categoria</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCategory === 'uncategorized' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {uncategorizedCount}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Product List Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold text-[#1C1C1E] tracking-tight">
            {selectedCategory === 'all'
              ? 'Todos os Produtos'
              : selectedCategory === 'uncategorized'
              ? 'Sem Categoria Definida'
              : categories.find(c => c.id === selectedCategory)?.name || 'Produtos'}
          </h2>
          {searchQuery && (
            <span className="text-xs text-slate-400 font-normal">
              (buscando por "{searchQuery}")
            </span>
          )}
        </div>

        <span className="text-xs font-medium text-slate-500 bg-white border border-black/[0.06] px-2.5 py-1 rounded-full shadow-2xs">
          {filteredProducts.length} {filteredProducts.length === 1 ? 'produto' : 'produtos'}
        </span>
      </div>

      {/* iOS Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-3xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-[#1C1C1E]">
            Nenhum produto encontrado
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `Não encontramos nenhum resultado para "${searchQuery}". Tente usar outros termos.`
              : 'Não há itens disponíveis nesta categoria no momento.'}
          </p>
          {(searchQuery || selectedCategory !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/20 transition-colors cursor-pointer"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {filteredProducts.map((product) => {
            const hasPromo = product.promotionalPrice && product.promotionalPrice < product.price;
            const displayPrice = hasPromo ? product.promotionalPrice! : product.price;

            return (
              <Link 
                key={product.id} 
                to={`/${store.slug}/p/${product.slug}`} 
                className="group flex flex-col bg-white rounded-2xl border border-black/[0.06] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* Product Thumbnail */}
                <div className="aspect-square bg-slate-100 overflow-hidden relative">
                  {product.images && product.images.length > 0 ? (
                    <StreamxImage
                      src={product.images[0]}
                      alt={product.name}
                      className="object-cover object-center w-full h-full group-hover:scale-104 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 text-xs font-medium">
                      <ShoppingBag className="w-8 h-8 stroke-[1.5] mb-1 opacity-40" />
                      <span>Sem Imagem</span>
                    </div>
                  )}

                  {/* iOS Badges Top Left & Right */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                    {product.isDigital ? (
                      <span className="bg-[#007AFF]/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                        Digital
                      </span>
                    ) : (
                      <span className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                        Físico
                      </span>
                    )}

                    {hasPromo && (
                      <span className="bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shadow-xs">
                        OFERTA
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Product Details */}
                <div className="p-3 sm:p-4 flex flex-col flex-1">
                  <h3 className="text-xs sm:text-sm font-semibold text-[#1C1C1E] group-hover:text-[#007AFF] line-clamp-2 transition-colors leading-snug">
                    {product.name}
                  </h3>

                  {product.shortDescription && (
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">
                      {product.shortDescription}
                    </p>
                  )}

                  <div className="mt-auto pt-3 flex items-end justify-between gap-1">
                    <div>
                      {hasPromo && (
                        <span className="text-[10px] text-slate-400 line-through block font-medium">
                          {formatCurrency(product.price)}
                        </span>
                      )}
                      <span className="text-sm sm:text-base font-extrabold text-[#1C1C1E] tracking-tight">
                        {formatCurrency(displayPrice)}
                      </span>
                    </div>

                    <div 
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-xs group-hover:scale-110 active:scale-95 transition-transform"
                      style={{ backgroundColor: themeColor }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
