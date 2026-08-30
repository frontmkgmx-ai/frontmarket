import { Outlet, useParams, Link } from 'react-router';
import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Store } from '../types';
import { useAuthStore } from '../store/authStore';

export function StorefrontLayout() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, signOut } = useAuthStore();

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Loja não encontrada</h1>
        <p className="text-gray-600">A loja que você está procurando não existe ou foi removida.</p>
      </div>
    );
  }

  // Use Store context or pass it via Outlet context
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b py-4 px-6 sticky top-0 bg-white z-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to={`/${store.slug}`} className="text-2xl font-bold tracking-tight" style={{ color: store.settings?.themeColor || '#000' }}>
            {store.name}
          </Link>
          
          <div className="flex items-center space-x-6">
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 hidden sm:block truncate max-w-[150px]">Olá, {user.email}</span>
                <button onClick={() => signOut()} className="text-sm text-gray-500 hover:text-gray-900">
                  Sair
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link to={`/${store.slug}/login`} className="text-sm font-medium text-gray-600 hover:text-gray-900">
                  Entrar
                </Link>
                <Link to={`/${store.slug}/register`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                  Criar conta
                </Link>
              </div>
            )}

            <Link to={`/${store.slug}/cart`} className="relative p-2 text-gray-600 hover:text-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </Link>
          </div>
        </div>
      </header>
      
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet context={{ store }} />
      </main>

      <footer className="border-t py-8 mt-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} {store.name}. Todos os direitos reservados.
          <br />
          <Link to="/" className="text-xs mt-2 block hover:text-indigo-600 transition-colors">Powered by Front MK</Link>
        </div>
      </footer>
    </div>
  );
}
