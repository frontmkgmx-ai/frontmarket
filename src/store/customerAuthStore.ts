import { create } from 'zustand';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Customer, CustomerAddress } from '../types';
import { withTimeout } from '../lib/asyncGuard';

interface RegisterCustomerData {
  username: string;
  password?: string;
  name: string;
  cpf: string;
  phone: string;
  email?: string;
  address?: CustomerAddress;
}

interface CustomerAuthState {
  customer: Customer | null;
  loading: boolean;
  error: string | null;
  loadCustomerSession: (storeId: string) => void;
  loginCustomer: (storeId: string, username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerCustomer: (storeId: string, data: RegisterCustomerData) => Promise<{ success: boolean; error?: string }>;
  logoutCustomer: (storeId: string) => void;
  checkUsernameAvailability: (storeId: string, username: string) => Promise<boolean>;
}

export const useCustomerAuthStore = create<CustomerAuthState>((set, get) => ({
  customer: null,
  loading: false,
  error: null,

  loadCustomerSession: (storeId: string) => {
    if (!storeId) return;
    try {
      const stored = localStorage.getItem(`fmk_customer_${storeId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Customer;
        set({ customer: parsed });
      } else {
        set({ customer: null });
      }
    } catch {
      set({ customer: null });
    }
  },

  checkUsernameAvailability: async (storeId: string, username: string): Promise<boolean> => {
    if (!storeId || !username.trim()) return false;
    const cleanUsername = username.trim().toLowerCase();
    
    try {
      const customersRef = collection(db, 'stores', storeId, 'customers');
      const q = query(customersRef, where('usernameLower', '==', cleanUsername));
      const snap = await withTimeout(getDocs(q), 3000, null as any);
      
      if (!snap || snap.empty) {
        return true;
      }
      return false;
    } catch (err) {
      console.warn("Aviso ao verificar disponibilidade de usuário do cliente:", err);
      return true; // Fallback para não bloquear
    }
  },

  loginCustomer: async (storeId: string, username: string, password: string) => {
    if (!storeId || !username.trim() || !password) {
      return { success: false, error: 'Preencha o usuário e a senha.' };
    }

    set({ loading: true, error: null });
    const cleanUsername = username.trim().toLowerCase();

    try {
      const customersRef = collection(db, 'stores', storeId, 'customers');
      const q = query(customersRef, where('usernameLower', '==', cleanUsername));
      
      const snap = await withTimeout(
        getDocs(q), 
        4000, 
        null as any,
        'Tempo limite ao autenticar cliente. Verifique sua conexão.'
      );

      if (!snap || snap.empty) {
        set({ loading: false, error: 'Usuário ou senha incorretos para esta loja.' });
        return { success: false, error: 'Usuário não encontrado nesta loja.' };
      }

      const customerDoc = snap.docs[0];
      const customerData = { id: customerDoc.id, ...customerDoc.data() } as Customer;

      // Validação de senha
      if (customerData.password && customerData.password !== password) {
        set({ loading: false, error: 'Usuário ou senha incorretos.' });
        return { success: false, error: 'Senha incorreta.' };
      }

      // Sessão válida
      set({ customer: customerData, loading: false, error: null });
      try {
        localStorage.setItem(`fmk_customer_${storeId}`, JSON.stringify(customerData));
      } catch {}

      return { success: true };
    } catch (err: any) {
      console.error("Erro no login do cliente:", err);
      const errorMsg = err.message || 'Erro ao realizar login. Tente novamente.';
      set({ loading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  registerCustomer: async (storeId: string, data: RegisterCustomerData) => {
    if (!storeId) {
      return { success: false, error: 'Identificador da loja inválido.' };
    }

    const cleanUsername = data.username.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      return { success: false, error: 'O nome de usuário deve conter no mínimo 3 caracteres.' };
    }

    if (!data.password || data.password.length < 4) {
      return { success: false, error: 'A senha deve conter no mínimo 4 caracteres.' };
    }

    if (!data.name.trim() || !data.cpf.trim() || !data.phone.trim()) {
      return { success: false, error: 'Por favor, preencha Nome completo, CPF e Telefone.' };
    }

    set({ loading: true, error: null });

    try {
      // 1. Verifica se o nome de usuário já está em uso nesta loja
      const isAvailable = await get().checkUsernameAvailability(storeId, cleanUsername);
      if (!isAvailable) {
        set({ loading: false, error: 'Este nome de usuário já está cadastrado nesta loja. Escolha outro.' });
        return { success: false, error: 'Este nome de usuário já está cadastrado nesta loja.' };
      }

      // 2. Cria identificador único para o cliente na loja
      const customerId = `cust_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const customerRef = doc(db, 'stores', storeId, 'customers', customerId);

      const newCustomer: Customer = {
        id: customerId,
        storeId,
        username: data.username.trim(),
        usernameLower: cleanUsername,
        password: data.password,
        name: data.name.trim(),
        email: data.email?.trim() || '',
        cpf: data.cpf.trim(),
        phone: data.phone.trim(),
        address: data.address || {
          zipcode: '',
          street: '',
          number: '',
          complement: '',
          neighborhood: '',
          city: '',
          state: ''
        },
        totalOrders: 0,
        totalSpent: 0,
        createdAt: new Date().toISOString()
      };

      await withTimeout(
        setDoc(customerRef, {
          ...newCustomer,
          serverCreatedAt: serverTimestamp()
        }),
        5000,
        null,
        'Tempo limite ao cadastrar cliente no Firestore.'
      );

      // 3. Salva sessão local
      set({ customer: newCustomer, loading: false, error: null });
      try {
        localStorage.setItem(`fmk_customer_${storeId}`, JSON.stringify(newCustomer));
      } catch {}

      return { success: true };
    } catch (err: any) {
      console.error("Erro no cadastro de cliente:", err);
      const errorMsg = err.message || 'Erro ao registrar cliente. Tente novamente.';
      set({ loading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  logoutCustomer: (storeId: string) => {
    set({ customer: null });
    if (storeId) {
      try {
        localStorage.removeItem(`fmk_customer_${storeId}`);
      } catch {}
    }
  }
}));
