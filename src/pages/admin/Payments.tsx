import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { 
  QrCode, 
  CheckCircle2, 
  Save,
  AlertCircle,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { FastCache } from '../../lib/cache';
import { withTimeout } from '../../lib/asyncGuard';
import { validatePixKey } from '../../lib/validators';

export function Payments() {
  const { activeStore } = useAuthStore();
  const cacheKey = activeStore ? `payments_settings_${activeStore.id}` : '';
  const cachedSettings = cacheKey ? FastCache.get<any>(cacheKey) : null;

  const [loading, setLoading] = useState<boolean>(() => !cachedSettings);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // PIX Settings (MisticPay)
  const [pixEnabled, setPixEnabled] = useState(cachedSettings?.pixEnabled ?? true);
  const [pixKeyType, setPixKeyType] = useState(cachedSettings?.pixKeyType || 'cpf');
  const [pixKey, setPixKey] = useState(cachedSettings?.pixKey || '');
  const [pixRecipient, setPixRecipient] = useState(cachedSettings?.pixRecipient || activeStore?.name || '');
  const [pixCity, setPixCity] = useState(cachedSettings?.pixCity || 'São Paulo');

  useEffect(() => {
    async function loadSettings() {
      if (!activeStore) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'stores', activeStore.id, 'settings', 'payments');
        const snap = await withTimeout(
          getDoc(docRef),
          3000,
          null
        );

        if (snap && snap.exists()) {
          const data = snap.data();
          setPixEnabled(data.pixEnabled ?? true);
          setPixKeyType(data.pixKeyType || 'cpf');
          setPixKey(data.pixKey || '');
          setPixRecipient(data.pixRecipient || activeStore.name || '');
          setPixCity(data.pixCity || 'São Paulo');

          if (cacheKey) FastCache.set(cacheKey, data);
        } else {
          setPixRecipient(activeStore.name || '');
        }
      } catch (err) {
        console.warn("Aviso ao carregar pagamentos:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [activeStore, cacheKey]);

  const [pixError, setPixError] = useState<string | null>(null);
  const [pixSuccess, setPixSuccess] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;
    
    setPixError(null);
    if (pixEnabled && pixKey) {
      const pixValidation = validatePixKey(pixKey);
      if (!pixValidation.valid) {
        setPixError('A chave Pix informada não é válida para o formato detectado.');
        return;
      }
    }

    setSaving(true);
    setSavedSuccess(false);

    try {
      const dataToSave = {
        gateway: 'misticpay',
        pixEnabled,
        pixKeyType,
        pixKey,
        pixRecipient,
        pixCity,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'stores', activeStore.id, 'settings', 'payments'), dataToSave);
      if (cacheKey) FastCache.set(cacheKey, dataToSave);
      
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar configurações de pagamento');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center">
        <div className="inline-block w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs sm:text-sm text-slate-500 mt-3">Carregando configurações de pagamento...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <QrCode className="w-6 h-6 sm:w-7 sm:h-7 text-teal-600" />
            Configurações de Pagamento (MisticPay)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Sistema financeiro exclusivo via PIX integrado com a MisticPay
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">Configurações salvas e ativadas com sucesso!</span>
        </div>
      )}

      {/* Card Info MisticPay */}
      <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/5 rounded-2xl border border-teal-200 p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5" />
        </div>
        <div className="space-y-1 text-xs sm:text-sm text-slate-700">
          <p className="font-bold text-slate-900">MisticPay: Gateway Único & Checkout Integrado</p>
          <p>
            Todos os pedidos de todas as lojas são processados via PIX dinâmico com confirmação instantânea através da MisticPay. Os fundos são creditados diretamente na Carteira para saque rápido.
          </p>
        </div>
      </div>

      {/* PIX Instantâneo */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">PIX no Checkout</h2>
              <p className="text-xs text-slate-500">Aprovação imediata com compensação em tempo real</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Tipo de Chave PIX Padrão para Recebimentos
              </label>
              <select
                value={pixKeyType}
                onChange={e => setPixKeyType(e.target.value)}
                className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
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
              <div className="relative">
                <input
                  type="text"
                  value={pixKey}
                  onChange={e => {
                    const val = e.target.value;
                    setPixKey(val);
                    setPixError(null);
                    setPixSuccess(null);
                    
                    if (val) {
                      const validation = validatePixKey(val);
                      if (validation.valid && validation.type) {
                        const typeMap: Record<string, string> = {
                          'CPF': 'cpf',
                          'CNPJ': 'cpf',
                          'EMAIL': 'email',
                          'PHONE': 'phone',
                          'EVP': 'random'
                        };
                        setPixKeyType(typeMap[validation.type] || 'cpf');
                        setPixSuccess(`Chave válida (${validation.type})`);
                      } else {
                        setPixError('Chave Pix inválida');
                      }
                    }
                  }}
                  placeholder="Ex: 123.456.789-00 ou pix@sualoja.com"
                  className={`w-full py-2 px-3 border ${pixError ? 'border-red-500' : (pixSuccess ? 'border-emerald-500' : 'border-slate-200')} rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none transition-colors`}
                />
                {pixError && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  </div>
                )}
                {pixSuccess && !pixError && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                )}
              </div>
              {pixError && (
                <p className="mt-1 text-[10px] text-red-500">{pixError}</p>
              )}
              {pixSuccess && !pixError && (
                <p className="mt-1 text-[10px] text-emerald-500">{pixSuccess}</p>
              )}
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
                className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
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
                className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Informação sobre Saques */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
          <p className="text-xs sm:text-sm text-slate-600">
            Acompanhe o saldo acumulado e solicite saques diretamente pela aba <strong>Carteira</strong>.
          </p>
        </div>
      </div>
    </form>
  );
}
