import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { seedStoreDemoData, clearStoreData } from '../../lib/seedHelper';
import { checkStoreNameAndSlugAvailability, AvailabilityResult } from '../../lib/storeValidation';
import { generateSlug } from '../../lib/utils';
import { 
  Settings as SettingsIcon, 
  Save, 
  CheckCircle2, 
  Trash2, 
  Sparkles, 
  AlertTriangle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Globe
} from 'lucide-react';
import { withTimeout, safeWrite } from '../../lib/asyncGuard';

export function Settings() {
  const { activeStore, setActiveStore } = useAuthStore();
  const [loading, setLoading] = useState(!activeStore);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Form State
  const [name, setName] = useState(activeStore?.name || '');
  const [slug, setSlug] = useState(activeStore?.slug || '');
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [validationResult, setValidationResult] = useState<AvailabilityResult | null>(null);

  const [themeColor, setThemeColor] = useState(activeStore?.settings?.themeColor || '#4f46e5');
  const [contactEmail, setContactEmail] = useState(activeStore?.settings?.contactEmail || '');
  const [supportPhone, setSupportPhone] = useState(activeStore?.settings?.supportPhone || '');
  const [currency, setCurrency] = useState(activeStore?.settings?.currency || 'BRL');

  // Seed / Cleanup State
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadStoreSettings() {
      if (!activeStore) {
        setLoading(false);
        return;
      }
      try {
        const docSnap = await withTimeout(
          getDoc(doc(db, 'stores', activeStore.id)),
          3000,
          null
        );

        if (docSnap && docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || '');
          setSlug(data.slug || '');
          setThemeColor(data.settings?.themeColor || '#4f46e5');
          setContactEmail(data.settings?.contactEmail || '');
          setSupportPhone(data.settings?.supportPhone || '');
          setCurrency(data.settings?.currency || 'BRL');
        }
      } catch (err) {
        console.warn("Aviso ao carregar configurações:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStoreSettings();
  }, [activeStore]);

  // Validação em tempo real do nome e slug no painel
  useEffect(() => {
    const cleanName = name.trim();
    const cleanSlug = slug.trim();

    if (!cleanName && !cleanSlug) return;
    if (activeStore && cleanName === activeStore.name && cleanSlug === activeStore.slug) {
      setValidationResult({
        isValid: true,
        nameAvailable: true,
        slugAvailable: true,
        nameError: null,
        slugError: null,
        sanitizedSlug: cleanSlug
      });
      setCheckingAvailability(false);
      return;
    }

    setCheckingAvailability(true);
    const timer = setTimeout(async () => {
      try {
        const res = await checkStoreNameAndSlugAvailability(cleanName, cleanSlug, activeStore?.id);
        setValidationResult(res);
      } catch (err) {
        console.warn("Erro ao validar disponibilidade:", err);
      } finally {
        setCheckingAvailability(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [name, slug, activeStore]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || saving) return;
    setValidationError('');

    const cleanName = name.trim();
    const cleanSlug = generateSlug(slug.trim() || cleanName);

    // Validação de disponibilidade
    const check = await checkStoreNameAndSlugAvailability(cleanName, cleanSlug, activeStore.id);
    if (!check.isValid) {
      setValidationError(check.nameError || check.slugError || 'Nome ou slug já estão em uso por outra loja.');
      return;
    }

    setSaving(true);
    setSavedSuccess(false);

    try {
      const updatedData = {
        name: cleanName,
        nameLower: cleanName.toLowerCase(),
        slug: cleanSlug,
        settings: {
          themeColor,
          contactEmail,
          supportPhone,
          currency
        }
      };

      await safeWrite(updateDoc(doc(db, 'stores', activeStore.id), updatedData));
      setActiveStore({ ...activeStore, ...updatedData });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar configurações da loja');
    } finally {
      setSaving(false);
    }
  };

  const handleRunSeed = async () => {
    if (!activeStore) return;
    if (!window.confirm('Isso irá popular sua loja com categorias, produtos com fotos, clientes e pedidos de teste. Deseja continuar?')) {
      return;
    }

    setIsSeeding(true);
    setActionMessage(null);
    try {
      const res = await seedStoreDemoData(activeStore.id);
      setActionMessage({
        type: 'success',
        text: `Loja populada com sucesso! ${res.productsCount} produtos, ${res.categoriesCount} categorias e ${res.ordersCount} pedidos gerados.`
      });
    } catch (err: any) {
      console.error(err);
      setActionMessage({ type: 'error', text: 'Erro ao gerar dados de teste.' });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleRunClean = async () => {
    if (!activeStore) return;
    if (!window.confirm('Tem certeza? Isso irá excluir todos os produtos, categorias, pedidos e clientes desta loja para deixá-la totalmente limpa.')) {
      return;
    }

    setIsCleaning(true);
    setActionMessage(null);
    try {
      await clearStoreData(activeStore.id);
      setActionMessage({
        type: 'success',
        text: 'Banco de dados da loja limpo com sucesso! A vitrine está pronta para novos cadastros.'
      });
    } catch (err: any) {
      console.error(err);
      setActionMessage({ type: 'error', text: 'Erro ao limpar banco de dados.' });
    } finally {
      setIsCleaning(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center">
        <div className="inline-block w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs sm:text-sm text-slate-500 mt-3">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header com HUD responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" />
            Configurações da Loja
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Personalize a identidade visual, dados de contato e gerencie os dados
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">Configurações salvas com sucesso!</span>
        </div>
      )}

      {validationError && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{validationError}</span>
        </div>
      )}

      {/* Formulário Principal */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-5">
        <h2 className="text-sm sm:text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          Identidade & Domínio
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Nome da Loja *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                maxLength={50}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              {checkingAvailability && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                </div>
              )}
            </div>
            {validationResult?.nameError && (
              <p className="text-xs text-red-600 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {validationResult.nameError}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Slug da URL (Link da Vitrine) *
            </label>
            <div className="flex items-center">
              <span className="bg-slate-100 border border-r-0 border-slate-200 text-slate-500 px-3 py-2 text-xs rounded-l-xl select-none">
                frontmarket.cysmk.online/
              </span>
              <input
                type="text"
                required
                maxLength={50}
                value={slug}
                onChange={(e) => setSlug(generateSlug(e.target.value))}
                className="w-full py-2 px-3 border border-slate-200 rounded-r-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono lowercase"
              />
            </div>
            {validationResult?.slugError && (
              <p className="text-xs text-red-600 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {validationResult.slugError}
              </p>
            )}
          </div>

          {/* Link público da loja */}
          <div className="sm:col-span-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700 font-medium">
              <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Link da sua vitrine pública:</span>
              <a
                href={`/${slug || generateSlug(name)}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-indigo-600 hover:underline font-semibold"
              >
                https://frontmarket.cysmk.online/{slug || generateSlug(name)}
              </a>
            </div>
            {validationResult?.isValid && (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Nome e link disponíveis
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Cor Principal da Marca
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="w-9 h-9 p-1 rounded-xl border border-slate-200 cursor-pointer"
              />
              <input
                type="text"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="w-28 py-2 px-3 border border-slate-200 rounded-xl text-xs font-mono uppercase focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Moeda Principal
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="BRL">Real Brasileiro (R$ - BRL)</option>
              <option value="USD">Dólar Americano ($ - USD)</option>
              <option value="EUR">Euro (€ - EUR)</option>
            </select>
          </div>
        </div>

        <h2 className="text-sm sm:text-base font-bold text-slate-900 border-b border-slate-100 pb-3 pt-3">
          Atendimento & Suporte ao Cliente
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              E-mail de Contato
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="suporte@sualoja.com"
              className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              WhatsApp de Suporte
            </label>
            <input
              type="text"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </form>

      {/* Seção de Automação & Limpeza do Banco de Dados */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-600" />
            Gerenciador de Dados do Banco (Realtime / Firestore)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Utilitários para popular automaticamente sua loja com produtos reais de demonstração ou realizar uma limpeza completa.
          </p>
        </div>

        {actionMessage && (
          <div className={`p-3.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 ${
            actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            {actionMessage.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          {/* Card Seed Demo */}
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-indigo-950 text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Popular com Dados de Teste
              </div>
              <p className="text-xs text-indigo-700/80 mt-1">
                Cria 4 categorias, 7 produtos com fotos reais em HD, estoque, clientes e pedidos simulados instantaneamente.
              </p>
            </div>
            <button
              onClick={handleRunSeed}
              disabled={isSeeding || isCleaning}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isSeeding ? 'Populando banco de dados...' : 'Gerar Dados de Teste (Seed)'}
            </button>
          </div>

          {/* Card Clean Data */}
          <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/40 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-rose-950 text-xs sm:text-sm">
                <Trash2 className="w-4 h-4 text-rose-600" />
                Limpar Banco de Dados da Loja
              </div>
              <p className="text-xs text-rose-700/80 mt-1">
                Remove todos os produtos, categorias, pedidos e clientes desta loja para deixá-la totalmente zerada.
              </p>
            </div>
            <button
              onClick={handleRunClean}
              disabled={isSeeding || isCleaning}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isCleaning ? 'Limpando dados...' : 'Limpar Todos os Dados'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
