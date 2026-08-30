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
  signOut: () => Promise<void>;
}

let authListener: Unsubscribe | null = null;
let profileListener: Unsubscribe | null = null;
let storeListener: Unsubscribe | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  activeStore: null,
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
        
        if (profile.stores && profile.stores.length > 0) {
          const storeDoc = await getDoc(doc(db, 'stores', profile.stores[0]));
          if (storeDoc.exists()) {
            set({ activeStore: { id: storeDoc.id, ...storeDoc.data() } as Store });
          }
        }
      }
    } catch (error: any) {
      console.error("Error fetching user data:", error.message || error);
    }
  },

  initialize: () => {
    if (authListener) return; // Evita múltiplos listeners
    
    authListener = onAuthStateChanged(auth, (firebaseUser) => {
      // Limpa listeners anteriores
      if (profileListener) {
        profileListener();
        profileListener = null;
      }
      if (storeListener) {
        storeListener();
        storeListener = null;
      }

      if (firebaseUser) {
        set({ user: firebaseUser, loading: true });

        // Inicia listener em tempo real para o perfil do usuário
        const userRef = doc(db, 'users', firebaseUser.uid);
        profileListener = onSnapshot(userRef, async (profileSnap) => {
          if (profileSnap.exists()) {
            const profile = profileSnap.data() as UserProfile;
            set({ profile });

            // Se o usuário possui lojas cadastradas, escuta a loja principal em tempo real
            if (profile.stores && profile.stores.length > 0) {
              const storeId = profile.stores[0];
              
              if (storeListener) storeListener();
              storeListener = onSnapshot(doc(db, 'stores', storeId), (storeSnap) => {
                if (storeSnap.exists()) {
                  set({ 
                    activeStore: { id: storeSnap.id, ...storeSnap.data() } as Store,
                    loading: false, 
                    initialized: true 
                  });
                } else {
                  set({ loading: false, initialized: true });
                }
              }, (err) => {
                console.error("Store snapshot error:", err);
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
          console.error("Profile snapshot error:", err);
          set({ loading: false, initialized: true });
        });
      } else {
        set({ 
          user: null, 
          profile: null, 
          activeStore: null, 
          loading: false, 
          initialized: true 
        });
      }
    });
  },
  
  setActiveStore: (store) => set({ activeStore: store }),
  
  signOut: async () => {
    if (profileListener) {
      profileListener();
      profileListener = null;
    }
    if (storeListener) {
      storeListener();
      storeListener = null;
    }
    await firebaseSignOut(auth);
    set({ user: null, profile: null, activeStore: null });
  }
}));
