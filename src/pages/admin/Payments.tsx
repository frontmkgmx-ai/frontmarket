import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { 
  CreditCard, 
  QrCode, 
  FileText, 
  CheckCircle2, 
  ShieldCheck, 
  Save, 
  AlertCircle,
  Zap,
  Lock
} from 'lucide-react';

export function Payments() {
  const { activeStore } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // PIX Settings
  const [pixEnabled, setPixEnabled] = useState(true);
  const [pixKeyType, setPixKeyType] = useState('cpf');
  const [pixKey, setPixKey] = useState('');
  const [pixRecipient, setPixRecipient] = useState('');
  const [pixCity, setPixCity] = useState('');

  // Cartão de Crédito
  const [cardEnabled, setCardEnabled] = useState(true);
  const [cardProvider, setCardProvider] = useState('mercadopago');
  const [maxInstallments, setMaxInstallments] = useState(12);
  const [interestFreeInstallments, setInterestFreeInstallments] = useState(3);

  // Boleto
  const [boletoEnabled, setBoletoEnabled] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      if (!activeStore) return;
      try {
        const docRef = doc(db, 'stores', activeStore.id, 'settings', 'payments');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setPixEnabled(data.pixEnabled ?? true);
          setPixKeyType(data.pixKeyType || 'cpf');
          setPixKey(data.pixKey || '');
          setPixRecipient(data.pixRecipient || activeStore.name || '');
          setPixCity(data.pixCity || 'São Paulo');
          setCardEnabled(data.cardEnabled ?? true);
          setCardProvider(data.cardProvider || 'mercadopago');
          setMaxInstallments(data.maxInstallments || 12);
          setInterestFreeInstallments(data.interestFreeInstallments || 3);
          setBoletoEnabled(data.boletoEnabled ?? false);
        } else {
          setPixRecipient(activeStore.name || '');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [activeStore]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;
    setSaving(true);
    setSavedSuccess(false);

    try {
      await setDoc(doc(db, 'stores', activeStore.id, 'settings', 'payments'), {
        pixEnabled,
        pixKeyType,
        pixKey,
        pixRecipient,
        pixCity,
        cardEnabled,
        cardProvider,
        maxInstallments: Number(maxInstallments),
        interestFreeInstallments: Number(interestFreeInstallments),
        boletoEnabled,
        updatedAt: new Date().toISOString()
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar meios de pagamento');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 mt-3">Carregando configurações de pagamento...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      {/* Header com HUD responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-indigo-600" />
            Meios de Pagamento & Checkout
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure o recebimento via PIX instantâneo, Cartão de Crédito e Boleto
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium">Configurações de pagamento salvas e ativadas com sucesso!</span>
        </div>
      )}

      {/* PIX Instantâneo */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">PIX Instantâneo</h2>
              <p className="text-xs text-slate-500">Aprovação imediata com compensação em segundos</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={pixEnabled} 
              onChange={e => setPixEnabled(e.target.checked)}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
          </label>
        </div>

        {pixEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Tipo de Chave PIX
              </label>
              <select
                value={pixKeyType}
                onChange={e => setPixKeyType(e.target.value)}
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="cpf">CPF / CNPJ</option>
                <option value="email">E-mail</option>
                <option value="phone">Telefone Celular</option>
                <option value="random">Chave Aleatória (EVP)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Chave PIX Cadastrada
              </label>
              <input
                type="text"
                value={pixKey}
                onChange={e => setPixKey(e.target.value)}
                placeholder="Ex: 123.456.789-00 ou pix@sualoja.com"
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Nome do Beneficiário / Titular
              </label>
              <input
                type="text"
                value={pixRecipient}
                onChange={e => setPixRecipient(e.target.value)}
                placeholder="Nome da sua loja ou titular da conta"
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Cidade do Titular
              </label>
              <input
                type="text"
                value={pixCity}
                onChange={e => setPixCity(e.target.value)}
                placeholder="Ex: São Paulo"
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Cartão de Crédito */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Cartão de Crédito</h2>
              <p className="text-xs text-slate-500">Parcelamento em até 12x com antifraude inteligente</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={cardEnabled} 
              onChange={e => setCardEnabled(e.target.checked)}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {cardEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Gateway de Pagamento
              </label>
              <select
                value={cardProvider}
                onChange={e => setCardProvider(e.target.value)}
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="mercadopago">Mercado Pago</option>
                <option value="stripe">Stripe</option>
                <option value="asaas">Asaas</option>
                <option value="pagarme">Pagar.me / Stone</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Parcelas Máximas
              </label>
              <select
                value={maxInstallments}
                onChange={e => setMaxInstallments(Number(e.target.value))}
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={1}>À vista (1x)</option>
                <option value={3}>Até 3x</option>
                <option value={6}>Até 6x</option>
                <option value={10}>Até 10x</option>
                <option value={12}>Até 12x</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Sem Juros Até
              </label>
              <select
                value={interestFreeInstallments}
                onChange={e => setInterestFreeInstallments(Number(e.target.value))}
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={1}>Somente 1x</option>
                <option value={2}>Até 2x sem juros</option>
                <option value={3}>Até 3x sem juros</option>
                <option value={6}>Até 6x sem juros</option>
                <option value={12}>Até 12x sem juros</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Boleto Bancário */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Boleto Bancário</h2>
              <p className="text-xs text-slate-500">Compensação em até 1 a 3 dias úteis</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={boletoEnabled} 
              onChange={e => setBoletoEnabled(e.target.checked)}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
          </label>
        </div>
      </div>
    </form>
  );
}
