import { create } from 'zustand';
import { Customer, CustomerAddress } from '../types';

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
        // Garante que nenhum dado sensível esteja no estado
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
      const res = await fetch(`/api/stores/${encodeURIComponent(storeId)}/customers/check-username?username=${encodeURIComponent(cleanUsername)}`);
      if (res.ok) {
        const data = await res.json();
        return !!data.available;
      }
      return true;
    } catch (err) {
      console.warn("[CustomerAuth] Falha ao checar disponibilidade:", err);
      return true;
    }
  },

  loginCustomer: async (storeId: string, username: string, password: string) => {
    if (!storeId || !username.trim() || !password) {
      return { success: false, error: 'Preencha o usuário e a senha.' };
    }

    set({ loading: true, error: null });

    try {
      const res = await fetch(`/api/stores/${encodeURIComponent(storeId)}/customers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Usuário ou senha incorretos.';
        set({ loading: false, error: errMsg });
        return { success: false, error: errMsg };
      }

      const customerData: Customer = data.customer;
      set({ customer: customerData, loading: false, error: null });

      try {
        localStorage.setItem(`fmk_customer_${storeId}`, JSON.stringify(customerData));
      } catch {}

      return { success: true };
    } catch (err: any) {
      console.error("[CustomerAuth] Erro no login:", err);
      const errorMsg = 'Erro de conexão ao realizar login. Tente novamente.';
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

    if (!data.password || data.password.length < 6) {
      return { success: false, error: 'A senha deve conter no mínimo 6 caracteres.' };
    }

    if (!data.name.trim() || !data.cpf.trim() || !data.phone.trim()) {
      return { success: false, error: 'Por favor, preencha Nome completo, CPF e Telefone.' };
    }

    set({ loading: true, error: null });

    try {
      const res = await fetch(`/api/stores/${encodeURIComponent(storeId)}/customers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          password: data.password,
          name: data.name.trim(),
          cpf: data.cpf.trim(),
          phone: data.phone.trim(),
          email: data.email?.trim() || '',
          address: data.address
        })
      });

      const resData = await res.json();

      if (!res.ok || !resData.success) {
        const errMsg = resData.error || 'Falha ao realizar cadastro.';
        set({ loading: false, error: errMsg });
        return { success: false, error: errMsg };
      }

      const newCustomer: Customer = resData.customer;
      set({ customer: newCustomer, loading: false, error: null });

      try {
        localStorage.setItem(`fmk_customer_${storeId}`, JSON.stringify(newCustomer));
      } catch {}

      return { success: true };
    } catch (err: any) {
      console.error("[CustomerAuth] Erro no cadastro:", err);
      const errorMsg = 'Erro de conexão ao registrar cliente. Tente novamente.';
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
