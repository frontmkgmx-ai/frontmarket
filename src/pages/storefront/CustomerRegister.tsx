import React, { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router';
import { Store, CustomerAddress } from '../../types';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { maskCPF, maskPhone, maskCEP } from '../../lib/utils';
import { validateIdentity } from '../../lib/identityValidators';
import { 
  User, 
  Lock, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Phone, 
  FileText, 
  MapPin, 
  Search,
  Sparkles
} from 'lucide-react';

export function CustomerRegister() {
  const { store } = useOutletContext<{ store: Store }>();
  const { registerCustomer, checkUsernameAvailability, loading, error: storeError } = useCustomerAuthStore();
  const navigate = useNavigate();

  const themeColor = store.settings?.themeColor || '#4f46e5';

  // Etapa atual: 1 = Credenciais de Acesso, 2 = Dados Pessoais & Endereço
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState('');
  
  const [cpfFeedback, setCpfFeedback] = useState<{valid: boolean; message: string} | null>(null);
  const [validatingCpf, setValidatingCpf] = useState(false);

  // Etapa 1 - Acesso
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  // Etapa 2 - Dados Pessoais & Endereço
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Endereço
  const [zipcode, setZipcode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);

  // Verificação em tempo real da disponibilidade do username na loja
  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (!clean || clean.length < 3 || !store?.id) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(store.id, clean);
        setUsernameAvailable(available);
      } catch {
        setUsernameAvailable(true);
      } finally {
        setCheckingUsername(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username, store?.id]);

  // Busca automática de endereço pelo CEP (ViaCEP)
  const handleCepLookup = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setStreet(data.logradouro || '');
          setNeighborhood(data.bairro || '');
          setCity(data.localidade || '');
          setState(data.uf || '');
        }
      } catch (err) {
        console.warn("Aviso ao buscar CEP:", err);
      } finally {
        setLoadingCep(false);
      }
    }
  };

  // Avançar da Etapa 1 para a Etapa 2
  const handleProceedToStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      setError('O nome de usuário deve conter no mínimo 3 caracteres (letras, números ou pontos).');
      return;
    }

    if (usernameAvailable === false) {
      setError('Este nome de usuário já está em uso por outro cliente nesta loja.');
      return;
    }

    if (!password || password.length < 4) {
      setError('A senha deve conter no mínimo 4 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('A confirmação da senha não confere com a senha digitada.');
      return;
    }

    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Concluir Registro Final (Etapa 2)
  const validateCpfField = async () => {
    const raw = cpf.replace(/\D/g, '');
    if (raw.length !== 11) return;
    
    setValidatingCpf(true);
    setCpfFeedback(null);
    try {
      const result = await validateIdentity(cpf, name);
      setCpfFeedback({
        valid: result.isValid,
        message: result.message
      });
    } catch(e) {
      setCpfFeedback({valid: false, message: 'Erro ao verificar CPF.'});
    } finally {
      setValidatingCpf(false);
    }
  };

  const handleFinalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Por favor, informe seu nome completo.');
      return;
    }

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setError('Por favor, informe um CPF válido.');
      return;
    }

    if (cpfFeedback && !cpfFeedback.valid) {
      setError('Verifique os avisos no seu documento antes de continuar.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Por favor, informe seu telefone com DDD.');
      return;
    }

    try {
      const identityResult = await validateIdentity(cpf, name);
      if (!identityResult.isValid) {
        setError(identityResult.message);
        return;
      }
    } catch (err: any) {
      setError('Erro ao validar documento. Tente novamente.');
      return;
    }

    const address: CustomerAddress = {
      zipcode: maskCEP(zipcode),
      street: street.trim(),
      number: number.trim(),
      complement: complement.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase()
    };

    const res = await registerCustomer(store.id, {
      username: username.trim(),
      password,
      name: name.trim(),
      cpf: maskCPF(cpf),
      phone: maskPhone(phone),
      email: email.trim(),
      address
    });

    if (res.success) {
      navigate(`/${store.slug}/checkout`, { replace: true });
    } else {
      setError(res.error || 'Erro ao registrar sua conta.');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-6 sm:py-12 px-3 sm:px-6">
      <div className="max-w-xl w-full bg-white p-5 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/80 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header com Progresso */}
        <div className="text-center space-y-2 mb-6">
          <div className="flex items-center justify-center gap-2">
            <span 
              className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                step === 1 ? 'text-white' : 'bg-emerald-100 text-emerald-700'
              }`}
              style={{ backgroundColor: step === 1 ? themeColor : undefined }}
            >
              {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
            </span>
            <div className={`h-1 w-12 rounded-full ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`} />
            <span 
              className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                step === 2 ? 'text-white' : 'bg-slate-100 text-slate-400'
              }`}
              style={{ backgroundColor: step === 2 ? themeColor : undefined }}
            >
              2
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {step === 1 ? 'Criar Acesso de Cliente' : 'Dados Pessoais & Entrega'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {step === 1 
              ? `Etapa 1 de 2: Escolha seu usuário e senha na ${store.name}` 
              : 'Etapa 2 de 2: Confirme seu CPF, telefone e endereço'}
          </p>
        </div>

        {/* Mensagem de Erro */}
        {(error || storeError) && (
          <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error || storeError}</span>
          </div>
        )}

        {/* ETAPA 1: USUÁRIO E SENHA */}
        {step === 1 && (
          <form onSubmit={handleProceedToStep2} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nome de Usuário *
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
                  maxLength={30}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  className="w-full pl-9 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-mono"
                  placeholder="ex: maria.silva"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingUsername && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                  {!checkingUsername && usernameAvailable === true && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                  {!checkingUsername && usernameAvailable === false && (
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  )}
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Usado exclusivamente para login nesta loja</span>
                {usernameAvailable === true && (
                  <span className="text-emerald-600 font-medium">Disponível</span>
                )}
                {usernameAvailable === false && (
                  <span className="text-rose-600 font-medium">Já em uso nesta loja</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Senha *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                    placeholder="Mínimo 4 dígitos"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirmar Senha *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                    placeholder="Repita a senha"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.99] cursor-pointer mt-2"
              style={{ backgroundColor: themeColor }}
            >
              <span>Continuar para Dados Pessoais</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ETAPA 2: DADOS PESSOAIS E ENDEREÇO */}
        {step === 2 && (
          <form onSubmit={handleFinalSubmit} className="space-y-4">
            
            {/* Bloco 1: Dados Pessoais */}
            <div className="p-3.5 sm:p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Identificação do Cliente
              </span>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Nome e Sobrenome"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    CPF *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      maxLength={14}
                      value={cpf}
                      onChange={(e) => {
                        setCpf(maskCPF(e.target.value));
                        setCpfFeedback(null);
                      }}
                      onBlur={validateCpfField}
                      className={`w-full px-3.5 py-2.5 bg-white border ${cpfFeedback ? (cpfFeedback.valid ? 'border-emerald-500' : 'border-red-500') : 'border-slate-200'} rounded-xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono transition-colors`}
                      placeholder="000.000.000-00"
                    />
                    {validatingCpf && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                      </div>
                    )}
                    {cpfFeedback && !validatingCpf && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {cpfFeedback.valid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  {cpfFeedback && (
                    <p className={`mt-1 text-[10px] ${cpfFeedback.valid ? 'text-emerald-500' : 'text-red-500'}`}>
                      {cpfFeedback.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-mail (opcional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="seuemail@exemplo.com"
                />
              </div>
            </div>

            {/* Bloco 2: Endereço */}
            <div className="p-3.5 sm:p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Endereço de Entrega
              </span>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    CEP
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={9}
                      value={zipcode}
                      onChange={(e) => {
                        const val = maskCEP(e.target.value);
                        setZipcode(val);
                        handleCepLookup(val);
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                      placeholder="00000-000"
                    />
                    {loadingCep && (
                      <Loader2 className="w-4 h-4 text-indigo-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                </div>

                <div className="col-span-1 flex items-end">
                  <span className="text-[10px] text-slate-400 leading-tight pb-2.5">
                    Preenchimento automático
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rua / Avenida
                  </label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Nome da rua"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Número
                  </label>
                  <input
                    type="text"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Nº"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Bairro"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Cidade"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado (UF)
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    placeholder="UF"
                  />
                </div>
              </div>
            </div>

            {/* Ações de Voltar e Salvar */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex-[2] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: themeColor }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Criando Conta...</span>
                  </>
                ) : (
                  <>
                    <span>Concluir Cadastro</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer com link para login */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-600">
            Já possui uma conta na {store.name}?{' '}
            <Link
              to={`/${store.slug}/login`}
              className="font-bold text-indigo-600 hover:underline"
            >
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
