import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
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
  ShieldCheck
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

interface WalletData {
  grossSales: number;
  approvedCount: number;
  totalFees: number;
  totalWithdrawn: number;
  availableBalance: number;
  blockedBalance: number;
}

export function Wallet() {
  const { activeStore } = useAuthStore();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixType, setPixType] = useState('CPF');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

    const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore?.id) return;
    
    setIsWithdrawing(true);
    setError('');
    setSuccessMsg('');
    
    try {
      const token = await useAuthStore.getState().user?.getIdToken();
      const res = await fetch(`/api/wallet/${activeStore.id}/withdraw`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: parseFloat(withdrawAmount),
          pixKey,
          pixKeyType: pixType
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar saque.');
      }
      
      setSuccessMsg('Saque solicitado com sucesso!');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setPixKey('');
      
      // trigger refresh
      setRefreshKey(prev => prev + 1);
      setTimeout(() => setSuccessMsg(''), 5000);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsWithdrawing(false);
    }
  };


  const handleCancelWithdrawal = async (id: string) => {
    if (!activeStore?.id) return;
    try {
      await deleteDoc(doc(db, 'stores', activeStore.id, 'withdrawals', id));
      setRefreshKey(prev => prev + 1);
      setSuccessMsg('Saque cancelado com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: any) {
      setError(e.message || 'Erro ao cancelar saque.');
    }
  };

  useEffect(() => {
    if (!activeStore?.id) return;
    const fetchWallet = async () => {
      setLoading(true);
      setError('');
      try {
        const storeId = activeStore.id;
        
        const ordersSnap = await getDocs(collection(db, 'stores', storeId, 'orders'));
        
        let totalGrossSales = 0;
        let totalFees = 0;
        let totalApprovedCount = 0;
        let availableBalanceAcc = 0;
        let blockedBalanceAcc = 0;

        const now = new Date().getTime();
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

        ordersSnap.forEach(doc => {
          const order = doc.data();
          if (order.status !== 'paid') return;

          const value = order.total || 0;
          const method = order.paymentMethod || 'pix';
          
          totalGrossSales += value;
          totalApprovedCount += 1;

          let fee = 0;
          if (method === 'credit_card' || method === 'debit_card') {
            fee = value * 0.13;
          } else if (method === 'boleto') {
            fee = value * 0.09;
          } else {
            fee = value * 0.07;
          }
          totalFees += fee;

          const netValue = value - fee;

          // Determinar se o saldo está liberado (3 dias)
          const paidAtDate = order.paidAt?.toDate?.() || order.createdAt?.toDate?.() || new Date();
          const isReleased = (now - paidAtDate.getTime()) >= THREE_DAYS_MS;

          if (isReleased) {
            availableBalanceAcc += netValue;
          } else {
            blockedBalanceAcc += netValue;
          }
        });

        let totalWithdrawn = 0;
        const withdrawalsList: any[] = [];
        try {
           const withSnap = await getDocs(collection(db, 'stores', storeId, 'withdrawals'));
           withSnap.forEach(doc => {
             const w = doc.data();
             withdrawalsList.push({ id: doc.id, ...w });
             if (w.status === 'pending' || w.status === 'completed') {
               totalWithdrawn += (w.amount || 0);
               totalWithdrawn += (w.fee || 10);
             }
           });
        } catch (e) {
           console.warn("Could not load withdrawals, maybe rules missing:", e);
        }

        // Sort withdrawals by date DESC
        withdrawalsList.sort((a, b) => {
           const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
           const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
           return dateB - dateA;
        });
        setWithdrawals(withdrawalsList);

        const availableBalance = Math.max(availableBalanceAcc - totalWithdrawn, 0);
        
        setWallet({
          grossSales: totalGrossSales,
          approvedCount: totalApprovedCount,
          totalFees: totalFees,
          totalWithdrawn: totalWithdrawn,
          availableBalance: availableBalance,
          blockedBalance: blockedBalanceAcc
        });

      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Erro ao carregar carteira.');
      } finally {
        setLoading(false);
      }
    };
    fetchWallet();
  }, [activeStore?.id, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Solicitar Saque</h3>
            <p className="text-sm text-slate-500 mb-6">O valor será transferido imediatamente via PIX pela Mistic Pay.</p>
            
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
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Chave PIX</label>
                <select 
                  value={pixType}
                  onChange={e => setPixType(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
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
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Sua chave PIX..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowWithdrawModal(false)} className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isWithdrawing} className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors">
                  {isWithdrawing ? 'Processando...' : 'Confirmar Saque'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <WalletIcon className="w-6 h-6 text-indigo-600" />
            Minha Carteira (Wallet)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie seu saldo individual, visualize taxas e solicite saques de forma segura.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 font-bold">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
          {error}
        </div>
      )}

      {/* Cards de Saldo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-bl-full -mr-4 -mt-4" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600">Saldo Disponível</h3>
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Banknote className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-black text-slate-900">
              {formatCurrency(wallet?.availableBalance || 0)}
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Saldo livre para saque
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600">Saldo Bloqueado</h3>
            <div className="p-2 bg-amber-50 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-black text-slate-900">
              {formatCurrency(wallet?.blockedBalance || 0)}
            </p>
            <p className="text-xs text-slate-500">
              Em período de liberação
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600">Vendas Aprovadas</h3>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-black text-slate-900">
              {formatCurrency(wallet?.grossSales || 0)}
            </p>
            <p className="text-xs text-slate-500">
              {wallet?.approvedCount || 0} pedidos confirmados
            </p>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 shadow-sm text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-300">Solicitar Saque</h3>
            <div className="p-2 bg-slate-800 rounded-lg">
              <ArrowUpRight className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div className="mt-4">
            <button onClick={() => setShowWithdrawModal(true)} className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors">
              Transferir Saldo
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Taxa fixa de saque: R$ 10,00
            </p>
          </div>
        </div>
      </div>

      {/* Seção de Taxas */}
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
                    É cobrada uma taxa de <strong className="text-slate-700">7%</strong> sobre cada venda aprovada utilizando Pix.
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
                    É cobrada uma taxa de <strong className="text-slate-700">9%</strong> sobre cada venda aprovada utilizando Boleto.
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
                    É cobrada uma taxa de <strong className="text-slate-700">13%</strong> sobre cada venda aprovada utilizando Cartão de Crédito/Débito.
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
                  Taxa fixa de <strong>R$ 10,00</strong> por cada solicitação de saque.
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  O cálculo de saldo ocorre de forma segura no servidor.
                </li>
                <li className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-indigo-400" />
                  Total de taxas descontadas até o momento: <strong>{formatCurrency(wallet?.totalFees || 0)}</strong>
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
                {withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {w.createdAt?.toDate ? w.createdAt.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recente'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                      {formatCurrency(w.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-rose-500">
                      -{formatCurrency(w.fee || 10)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                        {w.pixKeyType}: {w.pixKey}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {w.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Concluído
                        </span>
                      )}
                      {w.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Pendente
                          </span>
                          <button onClick={() => handleCancelWithdrawal(w.id)} className="text-xs text-rose-500 hover:text-rose-700 font-medium underline">
                            Cancelar
                          </button>
                        </div>
                      )}
                      {w.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          Cancelado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

