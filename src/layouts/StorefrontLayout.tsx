import { Outlet, useParams, Link } from 'react-router';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Store } from '../types';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { ShoppingBag, LogOut, ArrowLeft, RefreshCw } from 'lucide-react';
import { FastCache } from '../lib/cache';
import { withTimeout } from '../lib/asyncGuard';
import { SmartLoader } from '../components/SmartLoader';

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
  
  const { user, signOut } = useAuthStore();
  const { items } = useCartStore();

  const totalCartCount = items.reduce((acc, item) => acc + item.quantity, 0);

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

  if (loading && !store) {
    return (
      <SmartLoader 
        message="Conectando à loja..." 
        timeoutSeconds={4} 
        onRetry={fetchStore} 
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

  const themeColor = store.settings?.themeColor || '#4f46e5';

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Sticky Topbar HUD - Otimizado para Mobile e Desktop sem cortes */}
      <header className="border-b border-slate-200/80 py-3 px-4 sm:px-6 sticky top-0 bg-white/95 backdrop-blur-md z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Logo / Store Name */}
          <Link 
            to={`/${store.slug}`} 
            className="text-lg sm:text-2xl font-bold tracking-tight truncate hover:opacity-90 transition-opacity max-w-[200px] sm:max-w-md" 
            style={{ color: themeColor }}
          >
            {store.name}
          </Link>
          
          {/* User Controls & Cart */}
          <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 hidden md:block max-w-[140px] truncate font-medium">
                  {user.displayName || user.email}
                </span>
                <button 
                  onClick={() => signOut()} 
                  title="Sair"
                  className="p-2 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-3 text-xs font-semibold">
                <Link 
                  to={`/${store.slug}/login`} 
                  className="px-2 sm:px-2.5 py-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
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
        <Outlet context={{ store }} />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 sm:py-8 bg-slate-50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-xs text-slate-500 space-y-2">
          <div>
            &copy; {new Date().getFullYear()} <strong className="text-slate-800">{store.name}</strong>. Todos os direitos reservados.
          </div>
          <div>
            <Link to="/" className="text-[11px] text-slate-400 hover:text-indigo-600 transition-colors font-medium">
              Plataforma Front MK E-commerce
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
