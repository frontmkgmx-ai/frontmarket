import { Outlet, useParams, Link } from 'react-router';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Store } from '../types';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { ShoppingBag, User, LogOut, ArrowLeft } from 'lucide-react';

export function StorefrontLayout() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, signOut } = useAuthStore();
  const { items } = useCartStore();

  const totalCartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  useEffect(() => {
    async function loadStore() {
      if (!storeSlug) return;
      try {
        const q = query(collection(db, 'stores'), where('slug', '==', storeSlug));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const storeDoc = querySnapshot.docs[0];
          setStore({ id: storeDoc.id, ...storeDoc.data() } as Store);
        }
      } catch (error) {
        console.error("Error loading store:", error);
      } finally {
        setLoading(false);
      }
    }
    loadStore();
  }, [storeSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <header className="border-b py-4 px-4 sm:px-6 sticky top-0 bg-white/90 backdrop-blur-md z-30 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="h-7 w-28 bg-slate-200 rounded animate-pulse"></div>
            <div className="flex items-center space-x-4">
              <div className="h-6 w-16 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-8 w-8 bg-slate-200 rounded-full animate-pulse"></div>
            </div>
          </div>
        </header>
        
        <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-44 bg-slate-100 rounded-2xl w-full"></div>
            <div className="h-8 bg-slate-200 rounded w-48 mb-6"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="aspect-square bg-slate-200 rounded-xl"></div>
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Loja não encontrada</h1>
          <p className="text-sm text-slate-600">A loja que você está procurando não existe ou foi removida.</p>
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
      {/* Sticky Topbar HUD */}
      <header className="border-b border-slate-200/80 py-3.5 px-4 sm:px-6 sticky top-0 bg-white/95 backdrop-blur-md z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Logo / Store Name */}
          <Link 
            to={`/${store.slug}`} 
            className="text-xl sm:text-2xl font-bold tracking-tight truncate hover:opacity-90 transition-opacity" 
            style={{ color: themeColor }}
          >
            {store.name}
          </Link>
          
          {/* User Controls & Cart */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 hidden md:block max-w-[140px] truncate font-medium">
                  {user.displayName || user.email}
                </span>
                <button 
                  onClick={() => signOut()} 
                  title="Sair"
                  className="p-2 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3 text-xs font-semibold">
                <Link 
                  to={`/${store.slug}/login`} 
                  className="px-2.5 py-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Entrar
                </Link>
                <Link 
                  to={`/${store.slug}/register`} 
                  className="px-3 py-1.5 rounded-lg text-white shadow-xs transition-opacity hover:opacity-90 hidden xs:inline-block"
                  style={{ backgroundColor: themeColor }}
                >
                  Criar conta
                </Link>
              </div>
            )}

            {/* Shopping Cart Button with counter badge */}
            <Link 
              to={`/${store.slug}/cart`} 
              className="relative p-2 text-slate-700 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
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
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet context={{ store }} />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 bg-slate-50 mt-auto">
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
