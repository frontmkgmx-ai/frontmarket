import React, { useState, useEffect } from 'react';
import { Customer, Store } from '../types';
import { useCustomerAuthStore } from '../store/customerAuthStore';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  CreditCard, 
  Check, 
  Sparkles, 
  AlertCircle, 
  Loader2, 
  Image as ImageIcon,
  Lock,
  ExternalLink,
  LogOut,
  Package
} from 'lucide-react';
import { Link } from 'react-router';

interface CustomerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store;
}

export function CustomerProfileModal({ isOpen, onClose, store }: CustomerProfileModalProps) {
  const { customer, updateCustomerProfile, logoutCustomer } = useCustomerAuthStore();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [pixKeyType, setPixKeyType] = useState<'cpf' | 'cnpj' | 'email' | 'phone' | 'random'>('cpf');
  const [pixKey, setPixKey] = useState('');
  
  // Endereço
  const [zipcode, setZipcode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fetchingCep, setFetchingCep] = useState(false);
  const [showAvatarUrlInput, setShowAvatarUrlInput] = useState(false);

  // Sync state when customer changes or modal opens
  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      setEmail(customer.email || '');
      setPhone(customer.phone || '');
      setAvatarUrl(customer.avatarUrl || '');
      setPixKeyType(customer.pixKeyType || 'cpf');
      setPixKey(customer.pixKey || '');

      if (customer.address) {
        setZipcode(customer.address.zipcode || '');
        setStreet(customer.address.street || '');
        setNumber(customer.address.number || '');
        setComplement(customer.address.complement || '');
        setNeighborhood(customer.address.neighborhood || '');
        setCity(customer.address.city || '');
        setState(customer.address.state || '');
      }
    }
  }, [customer, isOpen]);

  if (!isOpen || !customer) return null;

  const handleCepLookup = async (cepRaw: string) => {
    const cleanCep = cepRaw.replace(/\D/g, '');
    setZipcode(cepRaw);
    if (cleanCep.length === 8) {
      setFetchingCep(true);
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
        console.warn('Erro ao consultar CEP:', err);
      } finally {
        setFetchingCep(false);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSaving(true);
    setSaveSuccess(false);

    try {
      const result = await updateCustomerProfile(store.id, customer.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        avatarUrl: avatarUrl.trim(),
        pixKey: pixKey.trim(),
        pixKeyType,
        address: {
          zipcode: zipcode.trim(),
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim(),
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state: state.trim()
        }
      });

      if (result.success) {
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);
      } else {
        setErrorMessage(result.error || 'Falha ao salvar dados.');
      }
    } catch (err: any) {
      setErrorMessage('Erro ao comunicar com o servidor.');
    } finally {
      setSaving(false);
    }
  };

  // Avatar presets rápidos (avatares divertidos / Memojis modernos)
  const avatarPresets = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif', // Cool GIF
    'https://media.giphy.com/media/l41lFw057lAJQMwg0/giphy.gif'  // Cyber cat gif
  ];

  const themeColor = store.settings?.themeColor || '#007AFF';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-md transition-all animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl max-h-[92vh] flex flex-col bg-[#F2F2F7] rounded-3xl shadow-2xl border border-white/20 overflow-hidden text-[#1C1C1E] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Modal Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-3.5 bg-white/80 backdrop-blur-xl border-b border-black/[0.08]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base font-semibold tracking-tight text-[#1C1C1E]">
              Meu Perfil Apple ID / Loja
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/[0.06] hover:bg-black/[0.12] text-slate-600 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* iOS Card 1: Avatar & Identity Header */}
          <div className="flex flex-col items-center justify-center text-center p-5 bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/[0.06]">
            <div className="relative group mb-3">
              <div 
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden p-0.5 border-2 border-dashed border-[#007AFF]/40 flex items-center justify-center bg-slate-100 shadow-inner"
              >
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={customer.name}
                    className="w-full h-full object-cover rounded-full"
                    onError={() => setAvatarUrl('')}
                  />
                ) : (
                  <div 
                    className="w-full h-full rounded-full flex items-center justify-center text-white text-3xl font-extrabold"
                    style={{ backgroundColor: themeColor }}
                  >
                    {customer.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowAvatarUrlInput(!showAvatarUrlInput)}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-[#007AFF] text-white shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title="Alterar Foto ou GIF"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-[#1C1C1E]">{customer.name}</h3>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-1 rounded-full bg-slate-100 text-xs text-slate-600 font-medium">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>@{customer.username}</span>
              <span className="text-[10px] text-slate-400 font-normal">(Login de Acesso)</span>
            </div>

            {/* Quick avatar input drawer if opened */}
            {showAvatarUrlInput && (
              <div className="w-full mt-4 p-3 bg-[#F2F2F7] rounded-xl border border-black/[0.06] text-left animate-in fade-in">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Link direto da Imagem ou GIF (URL pública):
                </label>
                <input
                  type="url"
                  placeholder="https://.../meu-avatar.gif"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#007AFF] mb-2"
                />
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  <span className="text-[11px] text-slate-500 shrink-0">Sugestões:</span>
                  {avatarPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(preset)}
                      className="w-7 h-7 rounded-full overflow-hidden border border-slate-200 shrink-0 hover:ring-2 ring-[#007AFF]"
                    >
                      <img src={preset} alt="preset" className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="text-[11px] text-rose-500 font-medium ml-auto hover:underline"
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            {/* iOS Grouped Section 1: Informações Pessoais */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 mb-1.5">
                Dados Pessoais & Contato
              </div>
              <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/[0.06] divide-y divide-black/[0.05] overflow-hidden">
                <div className="flex items-center px-4 py-2.5">
                  <span className="text-xs font-medium text-slate-500 w-28 shrink-0 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Nome
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full text-xs font-medium text-[#1C1C1E] bg-transparent focus:outline-none text-right sm:text-left"
                  />
                </div>

                <div className="flex items-center px-4 py-2.5">
                  <span className="text-xs font-medium text-slate-500 w-28 shrink-0 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> E-mail
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@email.com"
                    className="w-full text-xs font-medium text-[#1C1C1E] bg-transparent focus:outline-none text-right sm:text-left"
                  />
                </div>

                <div className="flex items-center px-4 py-2.5">
                  <span className="text-xs font-medium text-slate-500 w-28 shrink-0 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> WhatsApp
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full text-xs font-medium text-[#1C1C1E] bg-transparent focus:outline-none text-right sm:text-left"
                  />
                </div>

                <div className="flex items-center px-4 py-2.5 bg-slate-50/60">
                  <span className="text-xs font-medium text-slate-400 w-28 shrink-0 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" /> CPF
                  </span>
                  <span className="text-xs font-mono text-slate-600">
                    {customer.cpf ? customer.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4') : 'Não informado'}
                  </span>
                </div>
              </div>
            </div>

            {/* iOS Grouped Section 2: Chave Pix para Reembolsos */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 mb-1.5 flex items-center justify-between">
                <span>Chave Pix (Reembolsos & Estornos)</span>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                  Garantia de Devolução
                </span>
              </div>
              <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/[0.06] p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value={pixKeyType}
                    onChange={(e) => setPixKeyType(e.target.value as any)}
                    className="px-3 py-2 bg-[#F2F2F7] rounded-xl text-xs font-medium border border-black/[0.06] focus:outline-none"
                  >
                    <option value="cpf">CPF</option>
                    <option value="email">E-mail</option>
                    <option value="phone">Celular</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="random">Chave Aleatória (EVP)</option>
                  </select>

                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      placeholder={
                        pixKeyType === 'cpf' ? '000.000.000-00' :
                        pixKeyType === 'email' ? 'pix@exemplo.com' :
                        pixKeyType === 'phone' ? '(00) 90000-0000' :
                        pixKeyType === 'cnpj' ? '00.000.000/0000-00' :
                        'Chave aleatória de 32 dígitos'
                      }
                      className="w-full px-3 py-2 bg-[#F2F2F7] rounded-xl text-xs font-mono border border-black/[0.06] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Caso seu pedido sofra algum estorno, devolução ou cancelamento, a loja utilizará esta Chave Pix cadastrada para transferir seu reembolso de forma instantânea.
                </p>
              </div>
            </div>

            {/* iOS Grouped Section 3: Endereço de Entrega */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 mb-1.5 flex items-center justify-between">
                <span>Endereço de Entrega Principal</span>
                {fetchingCep && (
                  <span className="text-[10px] text-[#007AFF] flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Buscando CEP...
                  </span>
                )}
              </div>
              <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/[0.06] divide-y divide-black/[0.05] overflow-hidden">
                <div className="flex items-center px-4 py-2.5">
                  <span className="text-xs font-medium text-slate-500 w-28 shrink-0 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> CEP
                  </span>
                  <input
                    type="text"
                    maxLength={9}
                    value={zipcode}
                    onChange={(e) => handleCepLookup(e.target.value)}
                    placeholder="00000-000"
                    className="w-full text-xs font-mono text-[#1C1C1E] bg-transparent focus:outline-none text-right sm:text-left"
                  />
                </div>

                <div className="flex items-center px-4 py-2.5">
                  <span className="text-xs font-medium text-slate-500 w-28 shrink-0">
                    Rua / Avenida
                  </span>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Nome do logradouro"
                    className="w-full text-xs font-medium text-[#1C1C1E] bg-transparent focus:outline-none text-right sm:text-left"
                  />
                </div>

                <div className="grid grid-cols-2 divide-x divide-black/[0.05]">
                  <div className="flex items-center px-4 py-2.5">
                    <span className="text-xs font-medium text-slate-500 w-16 shrink-0">Nº</span>
                    <input
                      type="text"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder="123"
                      className="w-full text-xs font-medium text-[#1C1C1E] bg-transparent focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center px-4 py-2.5">
                    <span className="text-xs font-medium text-slate-500 w-20 shrink-0">Compl.</span>
                    <input
                      type="text"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      placeholder="Apto, Bloco..."
                      className="w-full text-xs font-medium text-[#1C1C1E] bg-transparent focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x divide-black/[0.05]">
                  <div className="px-3 py-2 col-span-1">
                    <label className="text-[10px] text-slate-400 block">Bairro</label>
                    <input
                      type="text"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      placeholder="Bairro"
                      className="w-full text-xs font-medium text-[#1C1C1E] bg-transparent focus:outline-none"
                    />
                  </div>
                  <div className="px-3 py-2 col-span-1">
                    <label className="text-[10px] text-slate-400 block">Cidade</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Cidade"
                      className="w-full text-xs font-medium text-[#1C1C1E] bg-transparent focus:outline-none"
                    />
                  </div>
                  <div className="px-3 py-2 col-span-1">
                    <label className="text-[10px] text-slate-400 block">UF</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      placeholder="SP"
                      className="w-full text-xs font-medium text-[#1C1C1E] bg-transparent focus:outline-none uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Error and Success alerts */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2 border border-rose-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-xl flex items-center gap-2 border border-emerald-200 animate-in fade-in">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Perfil e Chave Pix atualizados com sucesso!</span>
              </div>
            )}

            {/* iOS Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 px-4 rounded-2xl bg-[#007AFF] hover:bg-[#0071E3] active:scale-[0.99] text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando alterações...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  to={`/${store.slug}/orders`}
                  onClick={onClose}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-black/[0.08] text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Package className="w-4 h-4 text-slate-500" />
                  <span>Meus Pedidos</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    logoutCustomer(store.id);
                    onClose();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-600 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair da Conta</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
