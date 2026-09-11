import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { 
  Wallet as WalletIcon, 
  ArrowUpRight, 
  ArrowDownRight, 
  Info, 
  Banknote, 
  Percent, 
  CheckCircle2, 
  Clock, 
  Loader2, 
  ShieldCheck, 
  AlertCircle,
  XCircle
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

interface WalletData {
  grossSales: number;
  approvedCount: number;
  totalFees: number;
  totalWithdrawn: number;
  availableBalance: number;
  blockedBalance: number;
  pendingBalance: number;
  reservedBalance: number;
  nextReleaseAt?: string | null;
  pendingReleasesCount?: number;
}

export function Wallet() {
  const { activeStore } = useAuthStore();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixType, setPixType] = useState('CPF');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [withdrawIdempotencyKey, setWithdrawIdempotencyKey] = useState('');
  
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [pendingReleases, setPendingReleases] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const openWithdrawModal = () => {
    setWithdrawIdempotencyKey(crypto.randomUUID());
    setModalError('');
    setShowWithdrawModal(true);
  };

  const closeWithdrawModal = () => {
    setShowWithdrawModal(false);
    setModalError('');
    setWithdrawIdempotencyKey('');
  };

  const fetchWallet = useCallback(async () => {
    if (!activeStore?.id) return;
    setLoading(true);
    setError('');
    try {
      const token = await useAuthStore.getState().user?.getIdToken();
      if (!token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const res = await fetch(`/api/finances/${activeStore.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Falha ao obter dados da carteira.');
      }

      setWallet(data.wallet || null);
      setWithdrawals(data.withdrawals || []);
      setPendingReleases(data.pendingReleases || []);
    } catch (err: any) {
      console.error('[Wallet Frontend] Erro ao carregar carteira:', err);
      setError(err.message || 'Erro ao carregar informações financeiras.');
    } finally {
      setLoading(false);
    }
  }, [activeStore?.id]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet, refreshKey]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore?.id) return;
    
    setIsWithdrawing(true);
    setModalError('');
    setSuccessMsg('');
    
    try {
      const token = await useAuthStore.getState().user?.getIdToken();
      if (!token) {
        throw new Error('Sessão expirada. Por favor, autentique-se novamente.');
      }

      const res = await fetch(`/api/finances/${activeStore.id}/withdraw`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: parseFloat(withdrawAmount),
          pixKey: pixKey.trim(),
          pixKeyType: pixType,
          idempotencyKey: withdrawIdempotencyKey || crypto.randomUUID()
        })
      });

      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Erro ao processar saque.');
      }
      
      setSuccessMsg(data.message || 'Saque solicitado com sucesso!');
      closeWithdrawModal();
      setWithdrawAmount('');
      setPixKey('');
      
      // Atualiza os saldos consolidados do servidor
      setRefreshKey(prev => prev + 1);
      setTimeout(() => setSuccessMsg(''), 6000);
      
    } catch (err: any) {
      setModalError(err.message || 'Falha ao solicitar saque. Verifique as informações e tente novamente.');
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (loading && !wallet) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modal de Solicitação de Saque */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Solicitar Saque</h3>
            <p className="text-sm text-slate-500 mb-6">O valor será transferido diretamente via PIX pela Mistic Pay.</p>
            
            {modalError && (
              <div className="mb-4 p-3.5 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{modalError}</div>
              </div>
            )}
            
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Valor do Saque (R$)</label>
                <input 
                  type="number" 
                  min="20" 
                  step="0.01" 
                  required 
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  placeholder="20.00"
                />
                <p className="text-xs text-slate-400 mt-1">Valor mínimo: R$ 20,00 • Taxa fixa: R$ 10,00</p>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Chave PIX</label>
                <select 
                  value={pixType}
                  onChange={e => setPixType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-medium"
                >
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="TELEFONE">Telefone</option>
                  <option value="CHAVE_ALEATORIA">Chave Aleatória</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Chave PIX</label>
                <input 
                  type="text" 
                  required 
                  value={pixKey}
                  onChange={e => setPixKey(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  placeholder="Informe sua chave PIX..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={closeWithdrawModal} 
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isWithdrawing} 
                  className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  {isWithdrawing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Confirmar Saque'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <WalletIcon className="w-6 h-6 text-indigo-600" />
            Minha Carteira (Wallet)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão financeira e liquidez com conciliação contábil centralizada no servidor.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Cards de Saldo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Liberado para Saque */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-bl-full -mr-4 -mt-4" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600">Saldo Liberado para Saque</h3>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Banknote className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-black text-slate-900">
              {formatCurrency(wallet?.availableBalance || 0)}
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Valor que já completou 3 dias e pode ser utilizado para saque.
            </p>
          </div>
        </div>

        {/* Card 2: Saldo Pendente (D+3) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600">Saldo Pendente (D+3)</h3>
            <div className="p-2 bg-amber-50 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-black text-slate-900">
              {formatCurrency(wallet?.pendingBalance || 0)}
            </p>
            <p className="text-xs text-slate-500">
              Pagamentos confirmados que ainda estão no período de segurança de 3 dias.
            </p>
          </div>
        </div>

        {/* Card 3: Saldo Reservado */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600">Saldo Reservado</h3>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-black text-slate-900">
              {formatCurrency(wallet?.reservedBalance || 0)}
            </p>
            <p className="text-xs text-slate-500">
              Valor temporariamente reservado para operações de saque em andamento.
            </p>
          </div>
        </div>

        {/* Card 4: Solicitar Saque */}
        <div className="bg-slate-900 rounded-2xl p-6 shadow-sm text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-300">Solicitar Saque</h3>
            <div className="p-2 bg-slate-800 rounded-lg">
              <ArrowUpRight className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div className="mt-4">
            <button 
              onClick={openWithdrawModal} 
              disabled={(wallet?.availableBalance || 0) < 20}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
            >
              Transferir Saldo
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Taxa fixa: R$ 10,00 • Mínimo: R$ 20,00
            </p>
          </div>
        </div>
      </div>

      {/* Liberações Programadas D+3 (72h) */}
      {pendingReleases.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Liberações Programadas (D+3 / 72h)
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
              {pendingReleases.length} {pendingReleases.length === 1 ? 'pagamento em carência' : 'pagamentos em carência'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 whitespace-nowrap">Confirmação</th>
                  <th className="px-6 py-3 whitespace-nowrap">Liberação Automática</th>
                  <th className="px-6 py-3 whitespace-nowrap">Método</th>
                  <th className="px-6 py-3 whitespace-nowrap">Valor Líquido</th>
                  <th className="px-6 py-3 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingReleases.map((pr) => {
                  const confirmedStr = pr.confirmedAt
                    ? new Date(pr.confirmedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Recente';
                  const releaseStr = pr.releaseAt
                    ? new Date(pr.releaseAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Em 72h';

                  return (
                    <tr key={pr.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                        {confirmedStr}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-amber-700">
                        {releaseStr}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap uppercase text-xs font-mono text-slate-500">
                        {pr.paymentMethod || 'PIX'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-900">
                        {formatCurrency(pr.netAmount || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-500" />
                          Aguardando D+3
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seção de Taxas e Regras */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Percent className="w-4 h-4 text-indigo-500" />
            Informações e Taxas da Plataforma
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Taxa sobre Venda Aprovada (Pix)</h4>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Taxa fixa de <strong className="text-slate-700">7%</strong> sobre cada venda aprovada utilizando Pix.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Taxa sobre Venda Aprovada (Boleto)</h4>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Taxa de <strong className="text-slate-700">9%</strong> sobre cada venda aprovada utilizando Boleto.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Taxa sobre Venda Aprovada (Cartão)</h4>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Taxa de <strong className="text-slate-700">13%</strong> sobre cada venda aprovada utilizando Cartão.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-slate-400" />
                Regras de Saque
              </h4>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-rose-400" />
                  Taxa fixa de <strong>R$ 10,00</strong> por cada transferência solicitada.
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Autenticação e liquidação autorizada exclusivamente pelo servidor.
                </li>
                <li className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-indigo-400" />
                  Total sacado até o momento: <strong>{formatCurrency(wallet?.totalWithdrawn || 0)}</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de Saques */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            Histórico de Saques
          </h3>
        </div>
        
        {withdrawals.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Nenhum saque solicitado até o momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 whitespace-nowrap">Data</th>
                  <th className="px-6 py-3 whitespace-nowrap">Valor Solicitado</th>
                  <th className="px-6 py-3 whitespace-nowrap">Taxa</th>
                  <th className="px-6 py-3 whitespace-nowrap">Chave Pix</th>
                  <th className="px-6 py-3 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {withdrawals.map((w) => {
                  const displayAmount = w.amountCents !== undefined ? w.amountCents / 100 : (w.amount || 0);
                  const displayFee = w.feeCents !== undefined ? w.feeCents / 100 : (w.fee || 10);
                  const dateStr = w.createdAt 
                    ? new Date(w.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Recente';

                  return (
                    <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                        {dateStr}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                        {formatCurrency(displayAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-rose-500">
                        -{formatCurrency(displayFee)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono">
                          {w.pixKeyType}: {w.maskedPixKey || w.pixKey}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {w.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Concluído
                          </span>
                        )}
                        {(w.status === 'provider_pending' || w.status === 'processing' || w.status === 'reserved' || w.status === 'pending') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            <Clock className="w-3 h-3 animate-spin text-blue-500" />
                            Processando
                          </span>
                        )}
                        {w.status === 'reconciliation_required' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200" title="Verificando confirmação final com o gateway bancário">
                            <Clock className="w-3 h-3 text-amber-500" />
                            Reconciliando
                          </span>
                        )}
                        {(w.status === 'failed' || w.status === 'rejected' || w.status === 'cancelled') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200" title={w.failureReason || 'Falha ao processar'}>
                            <XCircle className="w-3 h-3 text-red-500" />
                            Falhou / Cancelado
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
