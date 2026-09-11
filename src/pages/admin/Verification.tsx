import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { 
  ShieldCheck, 
  AlertTriangle,
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Camera,
  X,
  Lock,
  UserCheck
} from 'lucide-react';
import { auth, db } from '../../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';

interface KycStatusData {
  status: string;
  verifiedAt?: string | null;
  canWithdraw?: boolean;
  verifiedName?: string | null;
  error?: string | null;
}

export function Verification() {
  const { activeStore } = useAuthStore();
  const [kycData, setKycData] = useState<KycStatusData>({
    status: 'not_started'
  });
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [modalCameraError, setModalCameraError] = useState<string | null>(null);

  // Consulta status oficial no backend autenticado
  const fetchBackendStatus = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch('/api/user/kyc-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setKycData(prev => ({
          ...prev,
          status: data.status || 'not_started',
          verifiedAt: data.verifiedAt,
          canWithdraw: data.canWithdraw
        }));
      }
    } catch (err: any) {
      console.warn('Erro ao carregar status do backend:', err);
    } finally {
      setLoading(false);
    }
  };

  // Listener em tempo real das atualizações geradas exclusivamente pelo backend no Firestore
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    fetchBackendStatus();

    const unsub = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const currentStatus = data?.kyc?.status || data?.kyc_status || 'not_started';
        
        setKycData(prev => ({
          ...prev,
          status: currentStatus.toLowerCase(),
          verifiedName: data?.verified_name,
          error: data?.kyc_error
        }));
      }
      setLoading(false);
    }, (err) => {
      console.warn('Listener error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleRequestKycStart = () => {
    setError(null);
    setModalCameraError(null);
    setShowCameraModal(true);
  };

  const handleConfirmCameraAndStart = async (forceStart: boolean | React.MouseEvent = false) => {
    const isForced = forceStart === true;

    try {
      setStarting(true);
      setModalCameraError(null);
      setError(null);
      
      setShowCameraModal(false);

      const user = auth.currentUser;
      if (!user) {
        throw new Error('Usuário não autenticado.');
      }
      const token = await user.getIdToken();
      
      const res = await fetch('/api/user/start-kyc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar sessão de verificação.');
      }
      
      if (data.verification_url) {
        // Redireciona para o fluxo da Didit de forma segura
        if (window.top) {
          window.top.location.href = data.verification_url;
        } else {
          window.location.href = data.verification_url;
        }
      } else {
        throw new Error('Link de verificação não retornado pelo servidor.');
      }
    } catch (err: any) {
      setModalCameraError(err.message || 'Ocorreu um erro ao autorizar a câmera.');
      setError(err.message || 'Ocorreu um erro ao conectar ao sistema de verificação.');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  const statusLower = kycData.status.toLowerCase();

  const isApproved = statusLower === 'approved';
  const isDeclined = statusLower === 'declined';
  const isReview = statusLower === 'review';
  const isPending = statusLower === 'in_progress' || statusLower === 'started';
  const isNotStarted = !isApproved && !isDeclined && !isReview && !isPending;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-600" />
            Verificação de Identidade (KYC)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Validação oficial de documentação e biometria para habilitação de saques.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* State: Approved */}
        {isApproved && (
          <div className="p-8 text-center bg-gradient-to-br from-emerald-50 to-teal-50/30">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Conta Verificada com Sucesso</h2>
            <p className="text-slate-600 max-w-md mx-auto mb-8 text-sm">
              Sua documentação e biometria foram autenticadas com sucesso. Sua conta está habilitada para solicitar saques via Pix.
            </p>
            
            <div className="max-w-sm mx-auto bg-white rounded-xl border border-emerald-100 shadow-sm text-left overflow-hidden">
              <div className="bg-emerald-600/10 px-4 py-2 border-b border-emerald-100">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Status da Validação
                </span>
              </div>
              <div className="p-4 space-y-3">
                {kycData.verifiedName && (
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Titular Validado</span>
                    <span className="text-sm font-semibold text-slate-800">{kycData.verifiedName}</span>
                  </div>
                )}
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Provedor Oficial</span>
                  <span className="text-sm font-semibold text-slate-800">Didit Identity Protocol</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Situação Cadastral</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 mt-0.5">
                    Habilitado para Saques
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State: Not Started or Declined */}
        {(isNotStarted || isDeclined) && (
          <div className="p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1 space-y-4">
              {isDeclined ? (
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-red-900">Verificação Não Aprovada</h3>
                    <p className="text-xs text-red-700 mt-1">
                      {kycData.error || 'Não foi possível aprovar os documentos na tentativa anterior. Por favor, certifique-se de apresentar foto nítida e documento original do titular.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  Verificação Pendente
                </div>
              )}
              
              <h2 className="text-xl font-bold text-slate-800">Validação de Identidade para Saques</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Em conformidade com as diretrizes regulatórias e de segurança da plataforma, a realização de saques exige a verificação de documento oficial com foto (RG ou CNH) e biometria facial (Liveness).
              </p>
              
              <ul className="text-sm text-slate-600 space-y-2 mt-4">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Ambiente criptografado ponta a ponta com link de sessão único.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Processamento biométrico antifraude seguro via Didit.</span>
                </li>
              </ul>
              
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
                  {error}
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={handleRequestKycStart}
                  disabled={starting}
                  className="inline-flex items-center justify-center px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {starting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Gerando Sessão Segura...
                    </>
                  ) : (
                    <>
                      Iniciar Verificação Oficial <ExternalLink className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="w-full md:w-1/3">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner">
                <h3 className="text-sm font-bold text-slate-800 mb-4 text-center">Etapas do Processo</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-indigo-700">1</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">Documento Oficial (CNH / RG)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-indigo-700">2</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">Biometria Facial (Liveness)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-indigo-700">3</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">Liberação Imediata de Saques</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State: Pending or Review */}
        {(isPending || isReview) && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              {isReview ? 'Em Análise pelo Provedor' : 'Verificação em Andamento'}
            </h2>
            <p className="text-slate-600 max-w-md mx-auto mb-6 text-sm">
              {isReview 
                ? 'Os seus documentos estão em processo de validação de segurança. Assim que for concluído, o status será atualizado automaticamente.'
                : 'Você possui uma sessão de verificação ativa. Se você fechou a janela anterior ou precisa reiniciar o envio, clique abaixo:'}
            </p>
            
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="inline-flex items-center justify-center px-4 py-2 bg-slate-100 rounded-lg text-sm font-semibold text-slate-700">
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-slate-500" />
                Aguardando confirmação do provedor...
              </div>

              {isPending && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full mt-2">
                  <button
                    onClick={handleRequestKycStart}
                    disabled={starting}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
                  >
                    {starting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        Continuar ou Reiniciar Verificação
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Modal de Permissão de Câmera */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all transform animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative px-6 pt-6 pb-4 flex items-start justify-between border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-sm shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Acesso à Câmera para Biometria
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verificação Oficial de Identidade
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCameraModal(false)}
                disabled={starting}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-slate-600 text-sm">
              <p className="leading-relaxed text-slate-700">
                A etapa de validação necessita de acesso à câmera do seu dispositivo:
              </p>

              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-slate-800 text-xs font-semibold">Captura do Documento</strong>
                    <span className="text-xs text-slate-600">Fotos nítidas da frente e do verso de RG ou CNH.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-slate-800 text-xs font-semibold">Biometria Facial em Tempo Real</strong>
                    <span className="text-xs text-slate-600">Comprovação de vivacidade para proteger sua conta contra invasões e fraudes.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-slate-800 text-xs font-semibold">Segurança & Privacidade</strong>
                    <span className="text-xs text-slate-600">Dados processados sob sigilo exclusivo para validação cadastral.</span>
                  </div>
                </div>
              </div>

              {modalCameraError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    Permissão Necessária
                  </div>
                  <p>{modalCameraError}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCameraModal(false)}
                disabled={starting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-all disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => handleConfirmCameraAndStart(false)}
                disabled={starting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm hover:shadow transition-all disabled:opacity-60"
              >
                {starting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Autorizar e Prosseguir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
