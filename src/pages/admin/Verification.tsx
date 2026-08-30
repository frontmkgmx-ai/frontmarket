import { useEffect, useState } from 'react';
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
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface KycStatus {
  kyc_status: string;
  session_id?: string;
  verified_name?: string;
  document_type?: string;
  face_match_score?: number;
  kyc_error?: string;
}

export function Verification() {
  const { activeStore } = useAuthStore();
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [modalCameraError, setModalCameraError] = useState<string | null>(null);

  const fetchKycStatus = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      
      setKycStatus({ 
        kyc_status: userData?.kyc_status || 'not_started',
        session_id: userData?.kyc_session_id,
        kyc_error: userData?.kyc_error
      } as any);
      
    } catch (err: any) {
      console.error('Failed to fetch KYC status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKycStatus();
    
    // Poll for status updates if it is in progress
    const interval = setInterval(() => {
      const statusLower = (kycStatus?.kyc_status || '').toLowerCase();
      if (statusLower === 'started' || statusLower === 'in progress' || statusLower === 'awaiting user' || statusLower === 'review' || statusLower === 'in review') {
        fetchKycStatus();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [kycStatus?.kyc_status]);

  const handleRequestKycStart = () => {
    setError(null);
    setModalCameraError(null);
    setShowCameraModal(true);
  };

  const handleConfirmCameraAndStart = async () => {
    try {
      setStarting(true);
      setModalCameraError(null);
      
      // Solicitar permissão de câmera explicitamente
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Seu navegador não possui suporte para captura de vídeo pela câmera.');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Libera a câmera temporária após confirmação
        stream.getTracks().forEach(track => track.stop());
      } catch (camErr: any) {
        if (camErr.name === 'NotAllowedError' || camErr.name === 'PermissionDeniedError') {
          throw new Error('Permissão negada. Por favor, clique no ícone de cadeado/câmera na barra de endereço do seu navegador e autorize o uso da câmera.');
        } else if (camErr.name === 'NotFoundError' || camErr.name === 'DevicesNotFoundError') {
          throw new Error('Nenhuma câmera foi detectada no seu dispositivo. Conecte uma câmera para continuar.');
        } else {
          throw new Error('Não foi possível acessar a câmera: ' + (camErr.message || 'Erro desconhecido'));
        }
      }

      // Usuário concedeu acesso à câmera; fecha modal e gera sessão segura
      setShowCameraModal(false);

      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      
      const res = await fetch('/api/user/start-kyc', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao iniciar verificação');
      }
      
      const data = await res.json();
      
      // Save the new session to Firestore directly from the client
      if (data.session_id) {
        await setDoc(doc(db, 'users', user.uid), {
          kyc_session_id: data.session_id,
          kyc_status: 'In Progress'
        }, { merge: true });
      }
      
      if (data.verification_url) {
        // Redirecionar para URL única e criptografada do Didit
        window.location.href = data.verification_url;
      }
    } catch (err: any) {
      setModalCameraError(err.message || 'Ocorreu um erro ao autorizar a câmera.');
      setError(err.message || 'Ocorreu um erro ao conectar ao sistema de verificação.');
      setStarting(false);
    }
  };

  const resetVerification = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;
      await setDoc(doc(db, 'users', user.uid), {
        kyc_status: 'not_started',
        kyc_session_id: null
      }, { merge: true });
      setKycStatus({ kyc_status: 'not_started' } as any);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  const statusLower = (kycStatus?.kyc_status || 'not_started').toLowerCase();

  const isApproved = statusLower === 'approved';
  const isDeclined = statusLower === 'declined';
  const isReview = statusLower === 'review' || statusLower === 'in review';
  const isPending = statusLower === 'started' || statusLower === 'in progress' || statusLower === 'awaiting user';
  const isNotStarted = !isApproved && !isDeclined && !isReview && !isPending;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-600" />
            Verificação de Identidade
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Mantenha sua conta segura validando seus documentos com a plataforma oficial.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* State: Approved */}
        {isApproved && (
          <div className="p-8 text-center bg-gradient-to-br from-emerald-50 to-teal-50/30">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg animate-[bounce_1s_ease-in-out]">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Conta Verificada e Aprovada</h2>
            <p className="text-slate-600 max-w-md mx-auto mb-8">
              Sua documentação está regularizada no sistema. A segurança de sua conta está garantida através do provedor oficial.
            </p>
            
            <div className="max-w-sm mx-auto bg-white rounded-xl border border-emerald-100 shadow-sm text-left overflow-hidden">
              <div className="bg-emerald-600/10 px-4 py-2 border-b border-emerald-100">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Resumo da Validação Didit
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Nome Reconhecido (OCR)</span>
                  <span className="text-sm font-semibold text-slate-800">{kycStatus.verified_name || 'Validado'}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Tipo Símbolo</span>
                  <span className="text-sm font-semibold text-slate-800">{kycStatus.document_type || 'Documento Oficial'}</span>
                </div>
                {kycStatus.face_match_score && (
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Score de Semelhança (Biometria)</span>
                    <span className="text-sm font-semibold text-slate-800">{kycStatus.face_match_score.toFixed(1)}% Precisão</span>
                  </div>
                )}
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Selo Oficial</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 mt-0.5">
                    DIDIT OK
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
                    <h3 className="text-sm font-bold text-red-900">Verificação Reprovada</h3>
                    <p className="text-xs text-red-700 mt-1">
                      {kycStatus?.kyc_error || 'Não foi possível aprovar sua documentação na última tentativa. Certifique-se de usar fotos nítidas, em ambiente iluminado e um documento válido (RG ou CNH).'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  Conta não verificada
                </div>
              )}
              
              <h2 className="text-xl font-bold text-slate-800">Complete sua verificação (KYC)</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Para aumentar a segurança do ecossistema e validar seus dados de lojista, precisamos confirmar sua identidade através de foto do documento (frente e verso) e uma rápida leitura biométrica facial (Liveness).
              </p>
              
              <ul className="text-sm text-slate-600 space-y-2 mt-4">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Ambiente criptografado e certificado (Link único, expira em 5 mins).</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Análise de dados automática, OCR e Face Match pela Didit.</span>
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
                      Gerando Link Seguro...
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
                <h3 className="text-sm font-bold text-slate-800 mb-4 text-center">Processo Rápido</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-indigo-700">1</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">Foto do Documento CNH/RG</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-indigo-700">2</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">Biometria Facial Ao Vivo</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-indigo-700">3</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">Validação Instantânea</span>
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
              {isReview ? 'Em Análise Manual' : 'Verificação Incompleta ou em Andamento'}
            </h2>
            <p className="text-slate-600 max-w-md mx-auto mb-6">
              {isReview 
                ? 'Sua documentação está passando por uma revisão de segurança final por nossa equipe. Você será notificado em breve.'
                : 'Você iniciou o processo de verificação. Caso tenha saído sem concluir (ex: enviou os documentos mas não finalizou a etapa facial), clique no botão abaixo para continuar de onde parou.'}
            </p>
            
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="inline-flex items-center justify-center px-4 py-2 bg-slate-100 rounded-lg text-sm font-semibold text-slate-700">
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-slate-500" />
                Aguardando provedor KYC...
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
                        Preparando ambiente...
                      </>
                    ) : (
                      <>
                        Continuar Verificação
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                  <button
                    onClick={resetVerification}
                    disabled={starting}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-200 transition-all hover:shadow-sm active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
                  >
                    Cancelar e Recomeçar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Diálogo / Modal de Permissão de Câmera */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all transform animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="camera-dialog-title"
          >
            {/* Header */}
            <div className="relative px-6 pt-6 pb-4 flex items-start justify-between border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-sm shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h3 id="camera-dialog-title" className="text-lg font-bold text-slate-900">
                    Permissão de Acesso à Câmera
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verificação Obrigatória de Identidade (KYC)
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

            {/* Content */}
            <div className="p-6 space-y-4 text-slate-600 text-sm">
              <p className="leading-relaxed text-slate-700">
                Para iniciar a verificação de segurança, a plataforma necessita de autorização para utilizar a câmera do seu dispositivo:
              </p>

              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-slate-800 text-xs font-semibold">Captura de Documentos</strong>
                    <span className="text-xs text-slate-600">Fotos nítidas da frente e do verso de documento com foto (RG ou CNH).</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-slate-800 text-xs font-semibold">Biometria Facial Ao Vivo</strong>
                    <span className="text-xs text-slate-600">Comprovação de vivacidade (Liveness) para confirmar que você é o titular legítimo.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-slate-800 text-xs font-semibold">Privacidade & Criptografia</strong>
                    <span className="text-xs text-slate-600">Imagens transmitidas em canal seguro certificado e utilizadas apenas para validação.</span>
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

              <p className="text-xs text-slate-500">
                Ao clicar no botão abaixo, o seu navegador poderá exibir uma solicitação no topo da tela. Clique em <strong>"Permitir"</strong> para continuar.
              </p>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCameraModal(false)}
                disabled={starting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-all disabled:opacity-60"
              >
                Agora Não / Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmCameraAndStart}
                disabled={starting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm hover:shadow transition-all disabled:opacity-60"
              >
                {starting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Solicitando permissão...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Permitir e Iniciar Verificação
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

