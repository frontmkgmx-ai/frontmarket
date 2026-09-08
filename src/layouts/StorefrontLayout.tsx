import { Outlet, useParams, Link } from 'react-router';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Store } from '../types';
import { useCustomerAuthStore } from '../store/customerAuthStore';
import { useCartStore } from '../store/cartStore';
import { ShoppingBag, LogOut, ArrowLeft, RefreshCw, User } from 'lucide-react';
import { FastCache } from '../lib/cache';
import { withTimeout } from '../lib/asyncGuard';
import { SmartLoader } from '../components/SmartLoader';
import { STORE_THEMES } from '../lib/themes';

export function StorefrontLayout() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  // Tenta carregar do cache instantâneo primeiro
  const [store, setStore] = useState<Store | null>(() => {
    return storeSlug ? FastCache.get<Store>(`store_${storeSlug}`) : null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return storeSlug ? !FastCache.get<Store>(`store_${storeSlug}`) : true;
  });
  const [error, setError] = useState<string | null>(null);
  
  const { customer, logoutCustomer, loadCustomerSession } = useCustomerAuthStore();
  const { items } = useCartStore();

  const totalCartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  // Carrega sessão do cliente para a loja atual
  useEffect(() => {
    if (store?.id) {
      loadCustomerSession(store.id);
    }
  }, [store?.id]);

  const fetchStore = async () => {
    if (!storeSlug) return;
    setError(null);
    try {
      const q = query(collection(db, 'stores'), where('slug', '==', storeSlug));
      
      // Limite de 4 segundos para evitar travamento em conexões lentas
      const querySnapshot = await withTimeout(
        getDocs(q),
        4000,
        undefined,
        'O carregamento da loja excedeu o tempo limite.'
      );
      
      if (querySnapshot && !querySnapshot.empty) {
        const storeDoc = querySnapshot.docs[0];
        const loadedStore = { id: storeDoc.id, ...storeDoc.data() } as Store;
        setStore(loadedStore);
        FastCache.set(`store_${storeSlug}`, loadedStore);
      } else {
        // Fallback robusto: se a loja não foi encontrada no Firestore, cria um objeto demo baseado no slug para teste imediato
        const demoStore: Store = {
          id: `demo_${storeSlug}`,
          name: storeSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          slug: storeSlug,
          ownerId: 'demo_owner',
          createdAt: new Date().toISOString(),
          settings: {
            currency: 'BRL',
            themeColor: '#4f46e5',
            contactEmail: 'contato@' + storeSlug + '.com',
            supportPhone: ''
          }
        };
        setStore(demoStore);
        FastCache.set(`store_${storeSlug}`, demoStore);
      }
    } catch (err: any) {
      console.warn("Aviso ao buscar loja, utilizando fallback:", err.message || err);
      // Fallback de emergência para NUNCA travar a vitrine do usuário
      const emergencyStore: Store = {
        id: `emergency_${storeSlug}`,
        name: storeSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        slug: storeSlug,
        ownerId: 'emergency_owner',
        createdAt: new Date().toISOString(),
        settings: {
          currency: 'BRL',
          themeColor: '#4f46e5',
          contactEmail: 'suporte@loja.com',
          supportPhone: ''
        }
      };
      setStore(emergencyStore);
      FastCache.set(`store_${storeSlug}`, emergencyStore);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStore();
  }, [storeSlug]);

  const loadingStyle = store?.settings?.loadingStyle || 'spinner';

  if (loading && !store) {
    return (
      <SmartLoader 
        message="Conectando à loja..." 
        timeoutSeconds={4} 
        onRetry={fetchStore} 
        styleType={loadingStyle}
      />
    );
  }

  if (error && !store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Falha ao Carregar Loja</h1>
          <p className="text-sm text-slate-600">{error}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <button
              onClick={() => { setLoading(true); fetchStore(); }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar Novamente
            </button>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Loja não encontrada</h1>
          <p className="text-sm text-slate-600">A loja que você está procurando não existe ou foi desativada.</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o início
          </Link>
        </div>
      </div>
    );
  }

  const currentThemeId = store.settings?.theme || 'default';
  const currentTheme = STORE_THEMES.find(t => t.id === currentThemeId) || STORE_THEMES[0];
  const themeColor = store.settings?.themeColor || '#4f46e5';
  
  const headerStyle = store.settings?.headerStyle || 'default';
  const footerStyle = store.settings?.footerStyle || 'default';

  const getHeaderLayout = () => {
    switch (headerStyle) {
      case 'centered':
        return 'flex-col sm:flex-row items-center justify-between gap-4 py-4';
      case 'minimalist':
        return 'justify-between py-2 border-b-0 shadow-none';
      case 'topnav':
        return 'justify-between py-2 bg-slate-900 text-white border-b-0 shadow-md';
      case 'dualnav':
        return 'justify-between py-3 border-b-4 shadow-sm';
      case 'sticky':
        return 'justify-between py-4 shadow-xl border-b-0';
      case 'floating':
        return 'justify-between py-3 px-6 mx-4 sm:mx-6 mt-4 mb-2 rounded-full border border-slate-200 shadow-lg';
      case 'appstyle':
        return 'justify-between py-4 border-b-0 shadow-sm sm:shadow-none';
      case 'logoright':
        return 'flex-row-reverse justify-between py-3';
      case 'compact':
        return 'justify-between py-2';
      default:
        return 'justify-between py-3';
    }
  };

  const getHeaderClasses = () => {
    let classes = `px-4 sm:px-6 sticky top-0 z-30 backdrop-blur-md bg-opacity-95 transition-all `;
    
    if (headerStyle === 'topnav') {
      classes += 'bg-slate-900 border-b-0 text-white shadow-md';
    } else if (headerStyle === 'floating') {
      classes += `${currentTheme.colors.surface} !top-4 !bg-opacity-100 rounded-full`;
    } else {
      classes += `${currentTheme.colors.surface} border-b border-slate-200/50 shadow-xs`;
    }
    
    if (headerStyle === 'dualnav') {
      classes = classes.replace('border-slate-200/50', '');
    }
    
    return classes;
  };

  const getFooterClasses = () => {
    switch (footerStyle) {
      case 'dark':
        return 'bg-slate-900 text-slate-400 border-t border-slate-800 py-8';
      case 'minimalist':
        return `${currentTheme.colors.surface} py-4 opacity-70 text-center border-t-0`;
      case 'multicolumn':
        return `${currentTheme.colors.surface} py-12 text-left border-t-2 border-slate-100`;
      case 'centered':
        return `${currentTheme.colors.surface} py-8 text-center border-t border-slate-200/50`;
      case 'banner':
        return `bg-indigo-50 text-indigo-900 border-t-4 py-8`;
      case 'floating':
        return `${currentTheme.colors.surface} mx-4 sm:mx-8 mb-4 rounded-3xl border shadow-xl py-6 text-center`;
      case 'fixed':
        return `${currentTheme.colors.surface} py-6 text-center shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)] border-t border-slate-200/50`;
      case 'modernlight':
        return `bg-slate-50 text-slate-500 rounded-t-3xl border-t border-slate-200 py-10`;
      case 'appbar':
        return `${currentTheme.colors.surface} py-4 border-t shadow-inner text-sm`;
      default:
        return `${currentTheme.colors.surface} border-t border-slate-200/50 py-6 sm:py-8`;
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${currentTheme.colors.background} ${currentTheme.colors.text} ${currentTheme.fontFamily}`}>
      {/* Sticky Topbar HUD - Otimizado para Mobile e Desktop sem cortes */}
      <header className={getHeaderClasses()} style={headerStyle === 'dualnav' ? { borderBottomColor: themeColor } : {}}>
        <div className={`max-w-7xl mx-auto flex items-center gap-2 ${getHeaderLayout()}`}>
          {/* Logo / Store Name */}
          <Link 
            to={`/${store.slug}`} 
            className={`text-lg sm:text-2xl font-bold tracking-tight truncate hover:opacity-90 transition-opacity flex items-center gap-2 max-w-[200px] sm:max-w-md ${headerStyle === 'centered' ? 'mx-auto sm:mx-0' : ''}`}
            style={{ color: headerStyle === 'topnav' ? '#ffffff' : themeColor }}
          >
            {store.settings?.logoUrl ? (
               <img src={store.settings.logoUrl} alt={store.name} className="h-10 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
            ) : (
               store.name
            )}
          </Link>

          {/* User Controls & Cart */}
          <div className={`flex items-center gap-1.5 sm:gap-4 shrink-0 ${headerStyle === 'centered' ? 'w-full sm:w-auto justify-center mt-2 sm:mt-0' : ''}`}>
            {customer && customer.storeId === store.id ? (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-xl">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: themeColor }}>
                  {customer.name?.charAt(0).toUpperCase() || 'C'}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs text-slate-800 font-bold block max-w-[120px] truncate leading-tight">
                    {customer.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block leading-none">
                    @{customer.username}
                  </span>
                </div>
                <button 
                  onClick={() => logoutCustomer(store.id)} 
                  title="Sair da Conta"
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-white transition-colors cursor-pointer ml-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-3 text-xs font-semibold">
                <Link 
                  to={`/${store.slug}/login`} 
                  className="px-2.5 sm:px-3 py-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
                >
                  Entrar
                </Link>
                <Link 
                  to={`/${store.slug}/register`} 
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg text-white shadow-xs transition-opacity hover:opacity-90 hidden xs:inline-block whitespace-nowrap"
                  style={{ backgroundColor: themeColor }}
                >
                  Criar conta
                </Link>
              </div>
            )}

            {/* Shopping Cart Button with counter badge */}
            <Link 
              to={`/${store.slug}/cart`} 
              className="relative p-2 text-slate-700 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Carrinho de Compras"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalCartCount > 0 && (
                <span 
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-in zoom-in"
                  style={{ backgroundColor: themeColor }}
                >
                  {totalCartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
      
      {/* Main Page Area */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        <Outlet context={{ store, currentTheme }} />
      </main>

      {/* Footer */}
      <footer className={`mt-auto ${getFooterClasses()}`}>
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 text-xs space-y-2`}>
          <div>
            &copy; {new Date().getFullYear()} <strong className={footerStyle === 'dark' ? 'text-white' : 'opacity-100'}>{store.name}</strong>. Todos os direitos reservados.
          </div>
          <div>
            <Link to="/" className={`text-[11px] font-medium transition-opacity ${footerStyle === 'dark' ? 'text-slate-500 hover:text-white' : 'opacity-60 hover:opacity-100'}`}>
              Plataforma Front MK E-commerce
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
