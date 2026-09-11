import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';

export function EmailsConfig() {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setSuccess(false);
    setTimeout(() => {
      setSaving(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuração de E-mails</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie as notificações transacionais por e-mail enviadas pelo sistema (Powered by Resend).</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Mail className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">E-mails Transacionais</h2>
            <p className="text-sm text-slate-500 mt-1">
              Para que os e-mails funcionem no ambiente de produção, certifique-se de ter configurado as variáveis de ambiente <strong>RESEND_API_KEY</strong> e <strong>RESEND_WEBHOOK_SECRET</strong> no painel de deploy da sua hospedagem.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Notificações para o Comprador</h3>
            
            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600" />
              <div>
                <span className="block text-sm font-semibold text-slate-800">Confirmação de Pagamento</span>
                <span className="block text-xs text-slate-500 mt-0.5">Envia um recibo detalhado quando o PIX/cartão é aprovado.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600" />
              <div>
                <span className="block text-sm font-semibold text-slate-800">Entrega de Produto Digital (Em Breve)</span>
                <span className="block text-xs text-slate-500 mt-0.5">Envia o link de download/acesso quando o produto é digital.</span>
              </div>
            </label>
            
            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600" />
              <div>
                <span className="block text-sm font-semibold text-slate-800">Atualização de Rastreio</span>
                <span className="block text-xs text-slate-500 mt-0.5">Avisa quando um produto físico for marcado como "Enviado".</span>
              </div>
            </label>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Importante</p>
              <p className="mt-1 opacity-90">A integração base com a API do Resend e o Webhook já foi gerada no servidor. O disparo efetivo das chaves/produtos digitais será acoplado nas próximas fases.</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          {success ? (
             <div className="flex items-center text-emerald-600 text-sm font-medium gap-1.5 animate-in fade-in slide-in-from-bottom-2">
               <CheckCircle2 className="w-4 h-4" /> Configurações salvas
             </div>
          ) : <div />}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-70 flex items-center gap-2"
          >
            {saving ? 'Salvando...' : 'Salvar Preferências'}
          </button>
        </div>
      </div>
    </div>
  );
}
