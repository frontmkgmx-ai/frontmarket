import { useState } from 'react';
import { CreditCard, CheckCircle2, Building2, Smartphone, DollarSign } from 'lucide-react';

interface Gateway {
  id: string;
  name: string;
  description: string;
  features: string[];
  logo: string;
  connected: boolean;
}

const AVAILABLE_GATEWAYS: Gateway[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Plataforma completa para pagamentos globais por cartão.',
    features: ['Cartão de Crédito', 'Apple Pay', 'Google Pay'],
    logo: '💳',
    connected: false,
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    description: 'Solução líder na América Latina. Aceite Pix, boletos e cartões.',
    features: ['Pix', 'Boleto', 'Cartão de Crédito'],
    logo: '🤝',
    connected: false,
  },
  {
    id: 'pagseguro',
    name: 'PagBank (PagSeguro)',
    description: 'Receba pagamentos com segurança e taxas competitivas no Brasil.',
    features: ['Pix', 'Cartão de Crédito', 'Débito'],
    logo: '💰',
    connected: false,
  },
  {
    id: 'pix_manual',
    name: 'Pix Direto (Manual)',
    description: 'Receba diretamente na sua conta. Requer verificação manual de comprovantes.',
    features: ['Pix sem taxas'],
    logo: '⚡',
    connected: false,
  }
];

export function PaymentGateways() {
  const [gateways, setGateways] = useState<Gateway[]>(AVAILABLE_GATEWAYS);

  const handleToggleConnect = (id: string) => {
    // Para preparar o site para produção sem simulações falsas,
    // apenas marcamos como conectado na UI localmente por enquanto,
    // mas em um cenário real isso redirecionaria para OAuth ou pediria chaves de API.
    setGateways(prev => prev.map(gw => 
      gw.id === id ? { ...gw, connected: !gw.connected } : gw
    ));
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
            Configure os métodos de pagamento que sua loja aceitará.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {gateways.map((gateway) => (
          <div key={gateway.id} className={`bg-white rounded-xl border ${gateway.connected ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-md' : 'border-slate-200 shadow-sm'} overflow-hidden transition-all flex flex-col`}>
            <div className="p-6 flex-1">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl shadow-sm">
                    {gateway.logo}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                      {gateway.name}
                      {gateway.connected && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
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
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 mt-auto">
              {gateway.connected ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Ativo
                  </span>
                  <button 
                    onClick={() => handleToggleConnect(gateway.id)}
                    className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Configurar
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => handleToggleConnect(gateway.id)}
                  className="w-full py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all text-sm"
                >
                  Conectar Gateway
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 mt-8">
        <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-amber-600" />
          Importante sobre Pagamentos
        </h4>
        <p className="text-sm text-amber-800">
          Esta plataforma está estruturada para suportar múltiplos gateways. A conexão real requer que você crie uma conta no provedor escolhido (como Mercado Pago ou Stripe) e insira as suas chaves de API exclusivas.
        </p>
      </div>
    </div>
  );
}
