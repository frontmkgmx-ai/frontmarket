import React, { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { doc, setDoc, collection, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { generateSlug } from '../../lib/utils';
import { withTimeout } from '../../lib/asyncGuard';
import { checkStoreNameAndSlugAvailability, AvailabilityResult } from '../../lib/storeValidation';
import { Store as StoreIcon, CheckCircle2, AlertCircle, Loader2, Globe, Sparkles, Lock, Edit3 } from 'lucide-react';
import { Store } from '../../types';

export function Onboarding() {
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [isCustomSlug, setIsCustomSlug] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [validationResult, setValidationResult] = useState<AvailabilityResult | null>(null);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, activeStore, profile, setStoreAndProfile } = useAuthStore();

  // Se o usuário já possui loja ativa válida configurada, redireciona para o painel
  useEffect(() => {
    if (activeStore && activeStore.name && activeStore.slug && profile?.stores && profile.stores.length > 0) {
      // Já possui loja configurada
      // Podemos redirecionar ou deixar criar nova loja se solicitado
    }
  }, [activeStore, profile]);

  // Atualização automática do slug quando o nome muda (se o usuário não customizou manualmente)
  const handleNameChange = (val: string) => {
    setStoreName(val);
    if (!isCustomSlug) {
      setSlug(generateSlug(val));
    }
  };

  const handleSlugChange = (val: string) => {
    setIsCustomSlug(true);
    setSlug(generateSlug(val));
  };

  // Efeito de validação em tempo real com Debounce (350ms)
  useEffect(() => {
    const cleanName = storeName.trim();
    const cleanSlug = slug.trim() || generateSlug(cleanName);

    if (!cleanName && !cleanSlug) {
      setValidationResult(null);
      setCheckingAvailability(false);
      return;
    }

    setCheckingAvailability(true);
    const timer = setTimeout(async () => {
      try {
        const res = await checkStoreNameAndSlugAvailability(cleanName, cleanSlug);
        setValidationResult(res);
      } catch (e) {
        console.warn('Erro na validação automática:', e);
      } finally {
        setCheckingAvailability(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [storeName, slug]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!storeName.trim() || !user || loading) return;
    
    setError('');
    setLoading(true);

    // Timeout de segurança local: se demorar mais de 6 segundos, reseta o botão para não travar o usuário
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 6000);

    try {
      const cleanName = storeName.trim();
      const finalSlug = (slug.trim() || generateSlug(cleanName));

      // Verificação de unicidade com timeout rápido
      const check = await withTimeout(
        checkStoreNameAndSlugAvailability(cleanName, finalSlug),
        3000,
        { isValid: true, nameAvailable: true, slugAvailable: true, nameError: null, slugError: null, sanitizedSlug: finalSlug }
      );
      
      if (!check.isValid) {
        clearTimeout(safetyTimer);
        setError(check.nameError || check.slugError || 'Nome ou link indisponível. Escolha outro.');
        setLoading(false);
        return;
      }
      
      const storeRef = doc(collection(db, 'stores'));
      const storeData = {
        name: cleanName,
        nameLower: cleanName.toLowerCase(),
        slug: finalSlug,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        settings: {
          currency: 'BRL',
          themeColor: '#4f46e5',
          contactEmail: user.email || '',
          supportPhone: ''
        }
      };

      // 1. Cria a loja e atualiza o usuário no Firestore com timeout seguro
      await withTimeout(
        Promise.all([
          setDoc(storeRef, storeData),
          setDoc(doc(db, 'users', user.uid), {
            name: user.displayName || cleanName,
            email: user.email,
            role: 'merchant',
            stores: arrayUnion(storeRef.id)
          }, { merge: true }),
          setDoc(doc(db, 'stores', storeRef.id, 'members', user.uid), {
            userId: user.uid,
            role: 'owner',
            joinedAt: serverTimestamp()
          }).catch(() => {}) // Não bloqueia se houver atraso na subcoleção
        ]),
        5000,
        null,
        'Não foi possível conectar ao servidor para gravar a loja.'
      );

      // 2. Prepara o objeto da nova loja
      const createdStore: Store = {
        id: storeRef.id,
        name: cleanName,
        slug: finalSlug,
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
        settings: {
          currency: 'BRL',
          themeColor: '#4f46e5',
          contactEmail: user.email || '',
          supportPhone: ''
        }
      };
      
      // 3. Atualiza o estado global de autenticação (perfil + loja) de forma síncrona
      setStoreAndProfile(createdStore, storeRef.id);
      clearTimeout(safetyTimer);

      // 4. Navega diretamente para o painel administrativo
      navigate('/admin', { replace: true });
    } catch (err: any) {
      clearTimeout(safetyTimer);
      console.error("Error creating store:", err);
      setError(err?.message || 'Erro ao criar a loja. Tente novamente.');
      setLoading(false);
    }
  };

  const isFormValid = Boolean(
    storeName.trim().length >= 3 &&
    (slug.trim() || generateSlug(storeName)).length >= 3 &&
    validationResult?.isValid &&
    !checkingAvailability
  );

  const displaySlug = slug.trim() || generateSlug(storeName);

  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="max-w-lg w-full space-y-6 bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 rounded-2xl border border-white/10 shadow-2xl">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 bg-gradient-to-tr from-teal-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-teal-500/30 backdrop-blur-md shadow-inner">
            <StoreIcon className="h-7 w-7 text-teal-300" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Defina o nome da sua loja
          </h2>
          <p className="text-sm text-slate-300 max-w-sm mx-auto">
            Escolha um nome exclusivo e seu link de acesso público será gerado instantaneamente.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/20 text-red-200 p-3.5 rounded-xl text-sm border border-red-500/30 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Nome da Loja */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-200" htmlFor="storeName">
              Nome do Estabelecimento / Marca *
            </label>
            <div className="relative">
              <input
                id="storeName"
                name="storeName"
                type="text"
                required
                maxLength={50}
                value={storeName}
                onChange={(e) => handleNameChange(e.target.value)}
                className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/15 placeholder-slate-400 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base backdrop-blur-sm transition-all"
                placeholder="Ex: Minha Loja Store"
              />
              {checkingAvailability && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
                </div>
              )}
            </div>
            {storeName.trim() && storeName.trim().length < 3 && (
              <p className="text-xs text-amber-300">
                O nome deve conter pelo menos 3 caracteres.
              </p>
            )}
            {validationResult?.nameError && (
              <p className="text-xs text-red-300 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {validationResult.nameError}
              </p>
            )}
          </div>

          {/* Slug / Link da URL */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-200" htmlFor="storeSlug">
                Link da URL (Slug exclusivo) *
              </label>
              <button
                type="button"
                onClick={() => {
                  if (isCustomSlug) {
                    setIsCustomSlug(false);
                    setSlug(generateSlug(storeName));
                  } else {
                    setIsCustomSlug(true);
                  }
                }}
                className="text-xs text-teal-300 hover:text-teal-200 flex items-center gap-1 transition-colors"
              >
                {isCustomSlug ? (
                  <>
                    <Lock className="w-3 h-3" /> Auto-sincronizar
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3 h-3" /> Personalizar link
                  </>
                )}
              </button>
            </div>
            
            <div className="flex rounded-xl overflow-hidden border border-white/15 bg-white/5 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 transition-all">
              <span className="inline-flex items-center px-3 text-xs sm:text-sm text-slate-400 bg-white/5 border-r border-white/10 select-none">
                frontmarket.cysmk.online/
              </span>
              <input
                id="storeSlug"
                name="storeSlug"
                type="text"
                required
                maxLength={50}
                value={displaySlug}
                onChange={(e) => handleSlugChange(e.target.value)}
                className="block w-full px-3 py-2.5 bg-transparent placeholder-slate-500 text-teal-300 focus:outline-none text-sm font-mono lowercase"
                placeholder="sua-loja"
              />
            </div>

            {/* Status da URL */}
            {validationResult?.slugError ? (
              <p className="text-xs text-red-300 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {validationResult.slugError}
              </p>
            ) : isFormValid ? (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5 mt-1 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Nome e URL verificados e disponíveis no sistema!
              </p>
            ) : checkingAvailability ? (
              <p className="text-xs text-teal-300 flex items-center gap-1 mt-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Verificando unicidade no sistema...
              </p>
            ) : null}
          </div>

          {/* Card de Visualização do Link Público */}
          {displaySlug && (
            <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-500/20 text-xs text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 text-teal-300 font-semibold">
                <Globe className="w-3.5 h-3.5" />
                Endereço de Acesso à sua Vitrine:
              </div>
              <div className="font-mono text-teal-200 break-all select-all font-medium">
                https://frontmarket.cysmk.online/{displaySlug}
              </div>
            </div>
          )}

          {/* Botão de Envio */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="group relative w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(45,212,191,0.25)] cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Criando sua loja e preparando painel...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  Criar Loja e Acessar Painel
                </>
              )}
            </button>
          </div>

          <p className="text-center text-xs text-slate-400">
            Você não poderá acessar o painel administrativo sem antes definir o nome e slug exclusivo da sua loja.
          </p>
        </form>
      </div>
    </div>
  );
}

