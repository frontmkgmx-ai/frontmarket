import { create } from 'zustand';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile, Store } from '../types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  activeStore: Store | null;
  loading: boolean;
  initialized: boolean;
  initialize: () => void;
  reloadProfile: (retries?: number) => Promise<void>;
  setActiveStore: (store: Store | null) => void;
  signOut: () => Promise<void>;
}

let authListener: any = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  activeStore: null,
  loading: true,
  initialized: false,
  
  reloadProfile: async (retries = 3) => {
    const { user } = get();
    if (!user) return;
    
    for (let i = 0; i < retries; i++) {
      try {
        const profileDoc = await getDoc(doc(db, 'users', user.uid));
        let activeStore = null;

        if (profileDoc.exists()) {
          const profile = profileDoc.data() as UserProfile;
          
          if (profile.stores && profile.stores.length > 0) {
            const storeDoc = await getDoc(doc(db, 'stores', profile.stores[0]));
            if (storeDoc.exists()) {
              activeStore = { id: storeDoc.id, ...storeDoc.data() } as Store;
            }
          }
          
          set({ profile, activeStore });
        }
        return; // Success, exit retry loop
      } catch (error: any) {
        if (i === retries - 1) {
          console.error("Error fetching user data:", error.message || error);
        } else {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
  },

  initialize: () => {
    if (authListener) return; // Prevents multiple listeners
    
    authListener = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        set({ user: firebaseUser, loading: true });
        await get().reloadProfile();
        set({ loading: false, initialized: true });
      } else {
        set({ user: null, profile: null, activeStore: null, loading: false, initialized: true });
      }
    });
  },
  
  setActiveStore: (store) => set({ activeStore: store }),
  
  signOut: async () => {
    await firebaseSignOut(auth);
    set({ user: null, profile: null, activeStore: null });
  }
}));
