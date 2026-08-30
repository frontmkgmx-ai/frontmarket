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
  setActiveStore: (store: Store | null) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  activeStore: null,
  loading: true,
  initialized: false,
  initialize: () => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        set({ user: firebaseUser, loading: true });
        
        try {
          // Fetch user profile
          const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          let activeStore = null;

          if (profileDoc.exists()) {
            const profile = profileDoc.data() as UserProfile;
            
            // If they have stores, fetch the first one as active (for now)
            if (profile.stores && profile.stores.length > 0) {
              const storeDoc = await getDoc(doc(db, 'stores', profile.stores[0]));
              if (storeDoc.exists()) {
                activeStore = { id: storeDoc.id, ...storeDoc.data() } as Store;
              }
            }
            
            set({ profile, activeStore, loading: false, initialized: true });
          } else {
            set({ profile: null, activeStore: null, loading: false, initialized: true });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          set({ loading: false, initialized: true });
        }
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
