import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../firebase/config';
import { doc, updateDoc } from 'firebase-admin/firestore'; // wait no, client side
import { doc as firestoreDoc, updateDoc as firestoreUpdateDoc } from 'firebase/firestore';
import { STORE_THEMES } from '../../lib/themes';
import { Palette, CheckCircle2 } from 'lucide-react';

export function Personalization() {
  const { activeStore, setStore } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSelectTheme = async (themeId: string) => {
    if (!activeStore || saving) return;
    setSaving(true);
    setMessage('');
    
    try {
      await firestoreUpdateDoc(firestoreDoc(db, 'stores', activeStore.id), {
        'settings.theme': themeId
      });
      
      const updatedStore = {
        ...activeStore,
        settings: {
          ...activeStore.settings,
          theme: themeId
        }
      };
      
      setStore(updatedStore);
      setMessage('Tema atualizado com sucesso!');
      
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Erro ao atualizar tema.');
    } finally {
      setSaving(false);
    }
  };

  const currentThemeId = activeStore?.settings?.theme || 'default';
  const currentTheme = STORE_THEMES.find(t => t.id === currentThemeId) || STORE_THEMES[0];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-6 h-6 text-indigo-600" />
            Personalização
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Escolha um tema para personalizar a aparência da sua loja online.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {STORE_THEMES.map((theme) => {
          const isActive = theme.id === currentThemeId;
          
          return (
            <div 
              key={theme.id}
              className={`relative overflow-hidden rounded-2xl border-2 transition-all ${
                isActive ? 'border-indigo-600 shadow-md shadow-indigo-600/10 scale-[1.02]' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Theme Preview */}
              <div className={`p-6 ${theme.colors.background} ${theme.colors.text} ${theme.fontFamily} h-32 flex flex-col justify-center items-center`}>
                <div className={`px-4 py-2 ${theme.colors.surface} ${theme.borderRadius} shadow-sm border ${theme.colors.border} flex flex-col gap-2`}>
                  <div className="text-sm font-bold opacity-80">{theme.name}</div>
                  <div className={`h-2 w-16 ${theme.colors.primary} ${theme.borderRadius}`}></div>
                </div>
              </div>
              
              {/* Controls */}
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
    </div>
  );
}
