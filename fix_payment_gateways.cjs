const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/PaymentGateways.tsx', 'utf8');

// Replace Gateway config blocks
// I'll rewrite the component entirely since it requires adding lots of state variables for all gateways.

const newCode = `
import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, DollarSign, Key, Save, Loader2, Link as LinkIcon, ShieldCheck, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface Gateway {
  id: string;
  name: string;
  description: string;
  features: string[];
  logo: string;
}

const AVAILABLE_GATEWAYS: Gateway[] = [
  {
    id: 'invictuspay',
    name: 'InvictusPay',
    description: 'Gateway de pagamento integrado para PIX.',
    features: ['Pix'],
    logo: '⚡',
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    description: 'Solução líder na América Latina. Aceite Pix, boletos e cartões.',
    features: ['Pix', 'Boleto', 'Cartão de Crédito'],
    logo: '🤝',
  },
  {
    id: 'stripe',
    name: 'Stripe Connect',
    description: 'Plataforma completa para pagamentos globais por cartão.',
    features: ['Cartão de Crédito', 'Apple Pay', 'Google Pay'],
    logo: '💳',
  },
  {
    id: 'pagbank',
    name: 'PagBank (Connect)',
    description: 'Solução de pagamentos completa do PagSeguro.',
    features: ['Pix', 'Boleto', 'Cartão'],
    logo: '💰',
  },
  {
    id: 'infinitepay',
    name: 'InfinitePay',
    description: 'Pagamentos rápidos com as melhores taxas do Brasil.',
    features: ['Pix', 'Cartão de Crédito'],
    logo: '♾️',
  }
];

export function PaymentGateways() {
  const { activeStore } = useAuthStore();
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string } | null>(null);

  // States
  const [configs, setConfigs] = useState<Record<string, any>>({});

  useEffect(() => {
    if (activeStore?.id) {
      loadAllConfigs();
    }
  }, [activeStore?.id]);

  const loadAllConfigs = async () => {
    try {
      setLoading(true);
      const token = await useAuthStore.getState().user?.getIdToken();
      const gateways = ['invictuspay', 'mercadopago', 'stripe', 'pagbank', 'infinitepay'];
      
      const newConfigs: any = {};
      
      for (const gw of gateways) {
          const res = await fetch(\`/api/gateways/\${gw}/\${activeStore?.id}\`, {
            headers: { 'Authorization': \`Bearer \${token}\` }
          });
          if (res.ok) {
              newConfigs[gw] = await res.json();
              if (!newConfigs[gw].formData) {
                 newConfigs[gw].formData = {};
              }
          }
      }
      setConfigs(newConfigs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (gatewayId: string, field: string, value: any) => {
      setConfigs(prev => ({
          ...prev,
          [gatewayId]: {
              ...prev[gatewayId],
              formData: {
                  ...prev[gatewayId]?.formData,
                  [field]: value
              }
          }
      }));
  };

  const handleStatusChange = (gatewayId: string, active: boolean) => {
      setConfigs(prev => ({
          ...prev,
          [gatewayId]: {
              ...prev[gatewayId],
              status: active ? 'active' : 'inactive'
          }
      }));
  };

  const handleSave = async (gatewayId: string) => {
    try {
      setSaving(true);
      setTestResult(null);
      const conf = configs[gatewayId];
      const payload: any = {
          storeId: activeStore?.id,
          status: conf.status,
          ...conf.formData
      };

      const res = await fetch(\`/api/gateways/\${gatewayId}\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${await useAuthStore.getState().user?.getIdToken()}\`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await loadAllConfigs();
        setConfiguring(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (gatewayId: string) => {
    try {
      setSaving(true);
      setTestResult(null);
      const conf = configs[gatewayId];
      const payload: any = {
          storeId: activeStore?.id,
          ...conf.formData
      };

      const res = await fetch(\`/api/gateways/\${gatewayId}/test\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${await useAuthStore.getState().user?.getIdToken()}\`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true });
      } else {
        setTestResult({ error: data.error || 'Falha ao conectar' });
      }
    } catch (err) {
      setTestResult({ error: 'Erro de comunicação' });
    } finally {
      setSaving(false);
    }
  };

  const renderConfigForm = (gateway: Gateway) => {
      const conf = configs[gateway.id] || {};
      const status = conf.status === 'active';
      const formData = conf.formData || {};
      
      let fields = <div />;
      let canTest = true;

      if (gateway.id === 'invictuspay') {
          canTest = !!formData.apiKey || conf.hasKey;
          fields = (
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">API Key (sk_...)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      value={formData.apiKey || ''}
                      onChange={(e) => handleFieldChange(gateway.id, 'apiKey', e.target.value)}
                      placeholder={conf.hasKey ? conf.maskedKey : "sk_xxxxxxxxxxxxxxxx"}
                      className="pl-10 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                    />
                  </div>
              </div>
          );
      } else if (gateway.id === 'mercadopago') {
          canTest = !!formData.accessToken || conf.hasKey;
          fields = (
              <div className="space-y-3">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Access Token (APP_USR-...)</label>
                      <input
                          type="password"
                          value={formData.accessToken || ''}
                          onChange={(e) => handleFieldChange(gateway.id, 'accessToken', e.target.value)}
                          placeholder={conf.hasKey ? conf.maskedKey : "APP_USR-xxxxxxxx"}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Public Key (APP_USR-...)</label>
                      <input
                          type="text"
                          value={formData.publicKey !== undefined ? formData.publicKey : (conf.publicKey || '')}
                          onChange={(e) => handleFieldChange(gateway.id, 'publicKey', e.target.value)}
                          placeholder="APP_USR-xxxx"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                      />
                  </div>
              </div>
          );
      } else if (gateway.id === 'stripe') {
          canTest = !!formData.accountId || conf.hasAccountId;
          fields = (
              <div className="space-y-3">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Stripe Account ID (acct_...)</label>
                      <input
                          type="text"
                          value={formData.accountId !== undefined ? formData.accountId : (conf.accountId || '')}
                          onChange={(e) => handleFieldChange(gateway.id, 'accountId', e.target.value)}
                          placeholder="acct_xxxxxxxx"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Public Key (pk_live_...)</label>
                      <input
                          type="text"
                          value={formData.publicKey !== undefined ? formData.publicKey : (conf.publicKey || '')}
                          onChange={(e) => handleFieldChange(gateway.id, 'publicKey', e.target.value)}
                          placeholder="pk_live_xxxx"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                      />
                  </div>
              </div>
          );
      } else if (gateway.id === 'pagbank') {
          canTest = !!formData.accessToken || conf.hasToken;
          fields = (
              <div className="space-y-3">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Access Token</label>
                      <input
                          type="password"
                          value={formData.accessToken || ''}
                          onChange={(e) => handleFieldChange(gateway.id, 'accessToken', e.target.value)}
                          placeholder={conf.hasToken ? conf.maskedToken : "xxxxxxxx-xxxx-xxxx..."}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Account ID</label>
                      <input
                          type="text"
                          value={formData.accountId !== undefined ? formData.accountId : (conf.accountId || '')}
                          onChange={(e) => handleFieldChange(gateway.id, 'accountId', e.target.value)}
                          placeholder="Opcional"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                      />
                  </div>
              </div>
          );
      } else if (gateway.id === 'infinitepay') {
          canTest = true;
          fields = (
              <div className="space-y-3">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">InfiniteTag (handle)</label>
                      <input
                          type="text"
                          value={formData.infiniteHandle !== undefined ? formData.infiniteHandle : (conf.infiniteHandle || '')}
                          onChange={(e) => handleFieldChange(gateway.id, 'infiniteHandle', e.target.value)}
                          placeholder="seu_nome_usuario"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL</label>
                      <input
                          type="text"
                          value={formData.webhookUrl !== undefined ? formData.webhookUrl : (conf.webhookUrl || '')}
                          onChange={(e) => handleFieldChange(gateway.id, 'webhookUrl', e.target.value)}
                          placeholder="Opcional (Padrão do sistema)"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      />
                  </div>
              </div>
          );
      }

      return (
          <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900">Configuração {gateway.name}</h4>
              <button onClick={() => setConfiguring(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {fields}

            <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Sua chave será criptografada e armazenada com segurança.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={\`status-\${gateway.id}\`}
                checked={status}
                onChange={(e) => handleStatusChange(gateway.id, e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor={\`status-\${gateway.id}\`} className="text-sm font-medium text-slate-700">
                Ativar gateway na loja
              </label>
            </div>

            {testResult && (
              <div className={\`p-3 rounded-lg text-sm font-medium flex items-center gap-2 \${testResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}\`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {testResult.success ? 'Conectado com sucesso!' : testResult.error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleTestConnection(gateway.id)}
                disabled={saving || !canTest}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 text-sm"
              >
                {saving && !Object.keys(formData).length ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LinkIcon className="w-4 h-4 mr-2" />}
                Testar
              </button>
              <button
                onClick={() => handleSave(gateway.id)}
                disabled={saving}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 text-sm"
              >
                {saving && Object.keys(formData).length > 0 ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Configuração
              </button>
            </div>
          </div>
      );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-600" />
            Gateways de Pagamento
          </h2>
          <p className="text-slate-500 mt-1">
            Configure os métodos de pagamento exclusivos para sua loja.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {AVAILABLE_GATEWAYS.map((gateway) => {
          const conf = configs[gateway.id] || {};
          const isActive = conf.status === 'active';
          const isConfiguring = configuring === gateway.id;
          const isConnected = !!(conf.hasKey || conf.hasToken || conf.hasAccountId || conf.infiniteHandle);

          return (
            <div key={gateway.id} className={\`bg-white rounded-xl border \${isActive ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-md' : 'border-slate-200 shadow-sm'} overflow-hidden transition-all flex flex-col\`}>
              <div className="p-6 flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl shadow-sm">
                      {gateway.logo}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                        {gateway.name}
                        {isActive && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      </h3>
                    </div>
                  </div>
                </div>
                
                <p className="text-slate-600 text-sm mb-4">
                  {gateway.description}
                </p>
                
                <div className="space-y-2 mb-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Métodos Suportados:</h4>
                  <div className="flex flex-wrap gap-2">
                    {gateway.features.map(feature => (
                      <span key={feature} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full border border-slate-200">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                {isConfiguring && renderConfigForm(gateway)}
              </div>
              
              {!isConfiguring && (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 mt-auto">
                  {isActive ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Ativo
                      </span>
                      <button 
                        onClick={() => { setConfiguring(gateway.id); setTestResult(null); }}
                        className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        Configurar
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => { setConfiguring(gateway.id); setTestResult(null); }}
                      className="w-full py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all text-sm"
                    >
                      {isConnected ? 'Configurar Gateway' : 'Conectar Gateway'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 mt-8">
        <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-amber-600" />
          Importante sobre Pagamentos
        </h4>
        <p className="text-sm text-amber-800">
          Cada vendedor possui sua própria configuração de Gateway. O saldo gerado pelas vendas irá direto para a sua conta no provedor configurado. As credenciais de API são protegidas com criptografia de ponta a ponta.
        </p>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/pages/admin/PaymentGateways.tsx', newCode);
