import { create } from 'zustand';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { UserProfile, Store } from '../types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  activeStore: Store | null;
  loading: boolean;
  initialized: boolean;
  initialize: () => void;
  reloadProfile: () => Promise<void>;
  setActiveStore: (store: Store | null) => void;
  setStoreAndProfile: (store: Store, storeId: string) => void;
  signOut: () => Promise<void>;
}

let authListener: Unsubscribe | null = null;
let profileListener: Unsubscribe | null = null;
let storeListener: Unsubscribe | null = null;
let safetyTimeout: any = null;

// Recupera cache local imediato para inicialização a 0ms
const getInitialCache = () => {
  try {
    const cachedProfile = localStorage.getItem('fmk_cached_profile');
    const cachedStore = localStorage.getItem('fmk_cached_store');
    return {
      profile: cachedProfile ? JSON.parse(cachedProfile) : null,
      activeStore: cachedStore ? JSON.parse(cachedStore) : null,
    };
  } catch {
    return { profile: null, activeStore: null };
  }
};

const initialCache = getInitialCache();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: initialCache.profile,
  activeStore: initialCache.activeStore,
  loading: true,
  initialized: false,
  
  reloadProfile: async () => {
    const { user } = get();
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const profileDoc = await getDoc(userRef);
      
      if (profileDoc.exists()) {
        const profile = profileDoc.data() as UserProfile;
        set({ profile });
        try {
          localStorage.setItem('fmk_cached_profile', JSON.stringify(profile));
        } catch {}
        
        if (profile.stores && profile.stores.length > 0) {
          const storeDoc = await getDoc(doc(db, 'stores', profile.stores[0]));
          if (storeDoc.exists()) {
            const activeStore = { id: storeDoc.id, ...storeDoc.data() } as Store;
            set({ activeStore });
            try {
              localStorage.setItem('fmk_cached_store', JSON.stringify(activeStore));
            } catch {}
          }
        }
      }
    } catch (error: any) {
      console.warn("Aviso ao recarregar perfil:", error.message || error);
    }
  },

  initialize: () => {
    if (authListener) return; // Evita duplicação de listeners
    
    // Trava de segurança anti-loading infinito:
    // Se o Firebase demorar mais de 3.5 segundos, descongela o estado do app
    if (safetyTimeout) clearTimeout(safetyTimeout);
    safetyTimeout = setTimeout(() => {
      const current = get();
      if (!current.initialized || current.loading) {
        console.warn("Aviso: Inicialização de autenticação atingiu timeout seguro.");
        set({ loading: false, initialized: true });
      }
    }, 3500);

    authListener = onAuthStateChanged(auth, (firebaseUser) => {
      // Limpa listeners e timeouts anteriores
      if (safetyTimeout) clearTimeout(safetyTimeout);
      if (profileListener) {
        profileListener();
        profileListener = null;
      }
      if (storeListener) {
        storeListener();
        storeListener = null;
      }

      if (firebaseUser) {
        set({ user: firebaseUser });

        // Listener de perfil em tempo real com timeout de segurança
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        let profileTimeout = setTimeout(() => {
          // Se perfil demorar a responder, libera o loading
          set({ loading: false, initialized: true });
        }, 2500);

        profileListener = onSnapshot(userRef, async (profileSnap) => {
          clearTimeout(profileTimeout);

          if (profileSnap.exists()) {
            const profile = profileSnap.data() as UserProfile;
            set({ profile });
            try {
              localStorage.setItem('fmk_cached_profile', JSON.stringify(profile));
            } catch {}

            // Se o usuário possui lojas cadastradas, escuta a loja principal
            if (profile.stores && profile.stores.length > 0) {
              const storeId = profile.stores[0];
              
              if (storeListener) storeListener();
              
              let storeTimeout = setTimeout(() => {
                set({ loading: false, initialized: true });
              }, 2000);

              storeListener = onSnapshot(doc(db, 'stores', storeId), (storeSnap) => {
                clearTimeout(storeTimeout);
                if (storeSnap.exists()) {
                  const activeStore = { id: storeSnap.id, ...storeSnap.data() } as Store;
                  set({ 
                    activeStore,
                    loading: false, 
                    initialized: true 
                  });
                  try {
                    localStorage.setItem('fmk_cached_store', JSON.stringify(activeStore));
                  } catch {}
                } else {
                  set({ loading: false, initialized: true });
                }
              }, (err) => {
                clearTimeout(storeTimeout);
                console.warn("Aviso store snapshot:", err);
                set({ loading: false, initialized: true });
              });
            } else {
              set({ activeStore: null, loading: false, initialized: true });
            }
          } else {
            // Perfil ainda não gravado ou novo registro
            set({ loading: false, initialized: true });
          }
        }, (err) => {
          clearTimeout(profileTimeout);
          console.warn("Aviso profile snapshot:", err);
          set({ loading: false, initialized: true });
        });
      } else {
        // Usuário deslogado
        set({ 
          user: null, 
          profile: null, 
          activeStore: null, 
          loading: false, 
          initialized: true 
        });
        try {
          localStorage.removeItem('fmk_cached_profile');
          localStorage.removeItem('fmk_cached_store');
        } catch {}
      }
    });
  },
  
  setActiveStore: (store) => {
    set({ activeStore: store });
    try {
      if (store) {
        localStorage.setItem('fmk_cached_store', JSON.stringify(store));
      } else {
        localStorage.removeItem('fmk_cached_store');
      }
    } catch {}
  },

  setStoreAndProfile: (store: Store, storeId: string) => {
    const current = get();
    const existingStores = current.profile?.stores || [];
    const updatedStores = existingStores.includes(storeId) ? existingStores : [...existingStores, storeId];
    
    const updatedProfile: UserProfile = {
      id: current.user?.uid || '',
      name: current.user?.displayName || store.name,
      email: current.user?.email || '',
      role: 'merchant',
      stores: updatedStores,
      ...(current.profile || {})
    };
    updatedProfile.stores = updatedStores;

    set({ 
      activeStore: store, 
      profile: updatedProfile,
      loading: false,
      initialized: true
    });

    try {
      localStorage.setItem('fmk_cached_store', JSON.stringify(store));
      localStorage.setItem('fmk_cached_profile', JSON.stringify(updatedProfile));
    } catch {}
  },
  
  signOut: async () => {
    if (profileListener) {
      profileListener();
      profileListener = null;
    }
    if (storeListener) {
      storeListener();
      storeListener = null;
    }
    try {
      localStorage.removeItem('fmk_cached_profile');
      localStorage.removeItem('fmk_cached_store');
    } catch {}
    await firebaseSignOut(auth);
    set({ user: null, profile: null, activeStore: null, loading: false, initialized: true });
  }
}));
