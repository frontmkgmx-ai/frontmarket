import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Globe, Plus, Trash2, Link as LinkIcon, Loader2 } from 'lucide-react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase/config';

export function Domains() {
  const { activeStore } = useAuthStore();
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customDomains = activeStore?.customDomains || [];
  const defaultDomain = `${window.location.host}/${activeStore?.slug}`;

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !newDomain.trim()) return;

    let domainToAdd = newDomain.trim().toLowerCase();
    
    // Remove protocol and trailing slash if user pasted a full URL
    domainToAdd = domainToAdd.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // Basic validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domainToAdd) && !domainToAdd.includes('localhost')) {
      setError('Formato de domínio inválido. Use algo como meusite.com');
      return;
    }

    if (customDomains.includes(domainToAdd)) {
      setError('Este domínio já foi adicionado.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'stores', activeStore.id), {
        customDomains: arrayUnion(domainToAdd)
      });
      setNewDomain('');
    } catch (err: any) {
      setError(err.message || 'Erro ao adicionar domínio');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    if (!activeStore) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'stores', activeStore.id), {
        customDomains: arrayRemove(domain)
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao remover domínio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Globe className="w-6 h-6 text-indigo-600" />
            Domínios da Loja
          </h2>
          <p className="text-slate-500 mt-1">
            Configure domínios personalizados para sua loja.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-indigo-500" />
          Domínio Padrão (Imutável)
        </h3>
        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-lg">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-slate-400" />
            <div>
              <p className="font-medium text-slate-700">{defaultDomain}</p>
              <p className="text-xs text-slate-500">Este é o domínio padrão gerado pelo sistema.</p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
            Principal
          </span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4">Domínios Adicionais</h3>
        
        <form onSubmit={handleAddDomain} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="ex: www.minhaloja.com.br"
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !newDomain.trim()}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar
          </button>
        </form>

        <div className="space-y-3">
          {customDomains.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4 border border-dashed border-slate-200 rounded-lg">
              Nenhum domínio adicional configurado.
            </p>
          ) : (
            customDomains.map((domain) => (
              <div key={domain} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-indigo-200 transition-colors group">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-indigo-400" />
                  <div>
                    <p className="font-medium text-slate-800">{domain}</p>
                    <p className="text-xs text-slate-500">Status: Aguardando propagação DNS (CNAME)</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveDomain(domain)}
                  disabled={loading}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remover domínio"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
        <h4 className="font-semibold text-indigo-900 mb-2">Instruções de DNS</h4>
        <p className="text-sm text-indigo-700 mb-4">
          Para que seus domínios personalizados funcionem, você precisa apontá-los para nossos servidores.
        </p>
        <ul className="list-disc pl-5 space-y-2 text-sm text-indigo-800">
          <li>Acesse o painel onde você comprou o domínio (ex: Registro.br, HostGator, GoDaddy).</li>
          <li>Crie um registro do tipo <strong>CNAME</strong>.</li>
          <li>Aponte o valor (destino) para: <code className="bg-indigo-100 px-1.5 py-0.5 rounded font-mono text-indigo-900">marketplace.frontmk.online</code></li>
        </ul>
      </div>
    </div>
  );
}
