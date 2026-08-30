import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { STORE_THEMES } from '../../lib/themes';
import { Palette, CheckCircle2, Image as ImageIcon, LayoutTemplate, Box, Loader, Save, ArrowRight } from 'lucide-react';

const HEADER_STYLES = [
  { id: 'default', name: 'Padrão' },
  { id: 'centered', name: 'Centralizado' },
  { id: 'minimalist', name: 'Minimalista' },
  { id: 'topnav', name: 'Nav Superior' },
  { id: 'dualnav', name: 'Nav Dupla' },
  { id: 'sticky', name: 'Sticky Fixo' },
  { id: 'floating', name: 'Flutuante' },
  { id: 'appstyle', name: 'Estilo App' },
  { id: 'logoright', name: 'Logo à Direita' },
  { id: 'compact', name: 'Compacto' }
];

const FOOTER_STYLES = [
  { id: 'default', name: 'Padrão' },
  { id: 'dark', name: 'Escuro' },
  { id: 'minimalist', name: 'Minimalista' },
  { id: 'multicolumn', name: 'Informativo (Colunas)' },
  { id: 'centered', name: 'Centralizado' },
  { id: 'banner', name: 'Com Banner' },
  { id: 'floating', name: 'Flutuante' },
  { id: 'fixed', name: 'Fixo no Rodapé' },
  { id: 'modernlight', name: 'Moderno Claro' },
  { id: 'appbar', name: 'Barra de App' }
];

const LOADING_STYLES = [
  { id: 'spinner', name: 'Spinner Circular' },
  { id: 'dots', name: 'Dots Pulsantes' },
  { id: 'progressbar', name: 'Barra de Progresso' },
  { id: 'bouncing', name: 'Círculos Saltitantes' },
  { id: 'doublespin', name: 'Rotação Dupla' },
  { id: 'minimal', name: 'Spinner Minimalista' },
  { id: 'dotwave', name: 'Onda de Pontos' },
  { id: 'skeleton', name: 'Esqueleto (Shimmer)' },
  { id: 'ghost', name: 'Carregamento Fantasma' },
  { id: 'dashed', name: 'Círculo Tracejado' }
];

export function Personalization() {
  const { activeStore, setActiveStore } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'themes'|'layout'>('themes');

  const [formData, setFormData] = useState({
    logoUrl: '',
    headerStyle: 'default',
    footerStyle: 'default',
    loadingStyle: 'spinner'
  });

  useEffect(() => {
    if (activeStore?.settings) {
      setFormData({
        logoUrl: activeStore.settings.logoUrl || '',
        headerStyle: activeStore.settings.headerStyle || 'default',
        footerStyle: activeStore.settings.footerStyle || 'default',
        loadingStyle: activeStore.settings.loadingStyle || 'spinner'
      });
    }
  }, [activeStore]);

  const handleSelectTheme = async (themeId: string) => {
    if (!activeStore || saving) return;
    setSaving(true);
    setMessage('');
    
    try {
      await updateDoc(doc(db, 'stores', activeStore.id), {
        'settings.theme': themeId
      });
      
      const updatedStore = {
        ...activeStore,
        settings: {
          ...activeStore.settings,
          theme: themeId
        }
      };
      
      setActiveStore(updatedStore);
      setMessage('Tema atualizado com sucesso!');
      
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Erro ao atualizar tema.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || saving) return;
    setSaving(true);
    setMessage('');

    try {
      await updateDoc(doc(db, 'stores', activeStore.id), {
        'settings.logoUrl': formData.logoUrl,
        'settings.headerStyle': formData.headerStyle,
        'settings.footerStyle': formData.footerStyle,
        'settings.loadingStyle': formData.loadingStyle
      });
      
      const updatedStore = {
        ...activeStore,
        settings: {
          ...activeStore.settings,
          ...formData
        }
      };
      
      setActiveStore(updatedStore);
      setMessage('Configurações de layout salvas com sucesso!');
      
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const currentThemeId = activeStore?.settings?.theme || 'default';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-6 h-6 text-indigo-600" />
            Personalização da Loja
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure o tema, logotipo, estilos de cabeçalho, rodapé e loading.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-full max-w-md">
        <button
          onClick={() => setActiveTab('themes')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'themes' 
              ? 'bg-white text-indigo-700 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Temas Base
        </button>
        <button
          onClick={() => setActiveTab('layout')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'layout' 
              ? 'bg-white text-indigo-700 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Layout & Estilos
        </button>
      </div>

      {activeTab === 'themes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
          {STORE_THEMES.map((theme) => {
            const isActive = theme.id === currentThemeId;
            
            return (
              <div 
                key={theme.id}
                className={`relative overflow-hidden rounded-2xl border-2 transition-all ${
                  isActive ? 'border-indigo-600 shadow-md shadow-indigo-600/10 scale-[1.02]' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`p-6 ${theme.colors.background} ${theme.colors.text} ${theme.fontFamily} h-32 flex flex-col justify-center items-center`}>
                  <div className={`px-4 py-2 ${theme.colors.surface} ${theme.borderRadius} shadow-sm border ${theme.colors.border} flex flex-col gap-2`}>
                    <div className="text-sm font-bold opacity-80">{theme.name}</div>
                    <div className={`h-2 w-16 ${theme.colors.primary} ${theme.borderRadius}`}></div>
                  </div>
                </div>
                
                <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{theme.name}</h3>
                  </div>
                  <button
                    onClick={() => handleSelectTheme(theme.id)}
                    disabled={isActive || saving}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      isActive 
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {isActive ? 'Ativo' : 'Ativar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'layout' && (
        <form onSubmit={handleSaveLayout} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm animate-in fade-in">
          <div className="p-6 md:p-8 space-y-8">
            
            {/* Logo */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <ImageIcon className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-slate-800">Logotipo</h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  URL da Logo (PNG, SVG, JPG ou ICO)
                </label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/logo.png"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-slate-50 focus:bg-white"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Insira o link direto para a imagem. Deixe em branco para usar o nome da loja.
                </p>
                {formData.logoUrl && (
                  <div className="mt-4 p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center h-24">
                    <img src={formData.logoUrl} alt="Preview" className="max-h-full max-w-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>
            </div>

            {/* Cabeçalho */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <LayoutTemplate className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-bold text-slate-800">Estilo de Cabeçalho</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {HEADER_STYLES.map(style => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, headerStyle: style.id })}
                    className={`p-3 text-left rounded-xl border-2 transition-all text-sm font-medium flex flex-col gap-1 ${
                      formData.headerStyle === style.id 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900' 
                        : 'border-slate-200 hover:border-indigo-200 bg-white text-slate-700'
                    }`}
                  >
                    <span className="block">{style.name}</span>
                    {formData.headerStyle === style.id && <span className="text-[10px] uppercase font-bold text-indigo-500">Selecionado</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Rodapé */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Box className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-bold text-slate-800">Estilo de Rodapé</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {FOOTER_STYLES.map(style => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, footerStyle: style.id })}
                    className={`p-3 text-left rounded-xl border-2 transition-all text-sm font-medium flex flex-col gap-1 ${
                      formData.footerStyle === style.id 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900' 
                        : 'border-slate-200 hover:border-indigo-200 bg-white text-slate-700'
                    }`}
                  >
                    <span className="block">{style.name}</span>
                    {formData.footerStyle === style.id && <span className="text-[10px] uppercase font-bold text-indigo-500">Selecionado</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Loading */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Loader className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-bold text-slate-800">Animação de Carregamento</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {LOADING_STYLES.map(style => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, loadingStyle: style.id })}
                    className={`p-3 text-left rounded-xl border-2 transition-all text-sm font-medium flex flex-col gap-1 ${
                      formData.loadingStyle === style.id 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900' 
                        : 'border-slate-200 hover:border-indigo-200 bg-white text-slate-700'
                    }`}
                  >
                    <span className="block">{style.name}</span>
                    {formData.loadingStyle === style.id && <span className="text-[10px] uppercase font-bold text-indigo-500">Selecionado</span>}
                  </button>
                ))}
              </div>
            </div>

          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-70 disabled:pointer-events-none"
            >
              {saving ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar Configurações
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
