import React, { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate, useOutletContext, useLocation } from 'react-router';
import { Store } from '../../types';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { User, Lock, ArrowRight, Store as StoreIcon, AlertCircle, Loader2 } from 'lucide-react';

export function CustomerLogin() {
  const { store } = useOutletContext<{ store: Store }>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  
  const { customer, loginCustomer, loading, error: storeError, loadCustomerSession } = useCustomerAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const themeColor = store.settings?.themeColor || '#4f46e5';

  useEffect(() => {
    if (store?.id) {
      loadCustomerSession(store.id);
    }
  }, [store?.id]);

  useEffect(() => {
    if (customer && customer.storeId === store.id) {
      // Se já está logado nesta loja, redireciona para o checkout ou vitrine
      const returnUrl = (location.state as any)?.from || `/${store.slug}`;
      navigate(returnUrl, { replace: true });
    }
  }, [customer, store, navigate, location]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!username.trim() || !password) {
      setLocalError('Por favor, informe seu nome de usuário e senha.');
      return;
    }

    const res = await loginCustomer(store.id, username, password);
    if (res.success) {
      const returnUrl = (location.state as any)?.from || `/${store.slug}/checkout`;
      navigate(returnUrl, { replace: true });
    } else {
      setLocalError(res.error || 'Credenciais inválidas.');
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-6 sm:py-12 px-3 sm:px-6">
      <div className="max-w-md w-full bg-white p-5 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/80 animate-in fade-in zoom-in-95 duration-200">
        {/* Header do Card */}
        <div className="text-center space-y-2">
          <div 
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-white shadow-md shadow-indigo-500/20"
            style={{ backgroundColor: themeColor }}
          >
            <StoreIcon className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Área do Cliente
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Acesse sua conta exclusiva da <strong className="text-slate-800 font-semibold">{store.name}</strong>
          </p>
        </div>

        {/* Mensagem de Erro */}
        {(localError || storeError) && (
          <div className="mt-5 bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{localError || storeError}</span>
          </div>
        )}
        
        {/* Formulário de Login */}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nome de Usuário
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                @
              </span>
              <input
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                className="w-full pl-9 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-medium"
                placeholder="seu.usuario"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Senha de Acesso
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: themeColor }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Entrando...</span>
              </>
            ) : (
              <>
                <span>Entrar na Minha Conta</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer com link para registro */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center space-y-3">
          <p className="text-xs text-slate-600">
            Ainda não tem conta na {store.name}?
          </p>
          <Link
            to={`/${store.slug}/register`}
            className="inline-flex items-center justify-center w-full py-2.5 px-4 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"
          >
            Criar Nova Conta de Cliente
          </Link>
        </div>
      </div>
    </div>
  );
}
