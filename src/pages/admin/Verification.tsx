import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { 
  ShieldCheck, 
  AlertTriangle,
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { auth, db } from '../../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface KycStatus {
  kyc_status: string;
  session_id?: string;
  verified_name?: string;
  document_type?: string;
  face_match_score?: number;
}

export function Verification() {
  const { activeStore } = useAuthStore();
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKycStatus = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      // 1. Read the user's current KYC session from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      
      if (!userData?.kyc_session_id) {
        setKycStatus({ kyc_status: userData?.kyc_status || 'not_started' });
        setLoading(false);
        return;
      }
      
      const token = await user.getIdToken();
      
      // 2. Fetch the real-time status from our backend proxy (Didit API)
      const res = await fetch(`/api/user/kyc-status?session_id=${userData.kyc_session_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // 3. If there's an update (e.g. approved), update Firestore so it's persisted
        if (data.kyc_status !== userData.kyc_status) {
          await setDoc(doc(db, 'users', user.uid), {
            kyc_status: data.kyc_status,
            kyc_verified_name: data.verified_name || null,
            kyc_document_type: data.document_type || null
          }, { merge: true });
        }
        
        setKycStatus(data);
      }
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
      if (kycStatus?.kyc_status === 'started' || kycStatus?.kyc_status === 'review') {
        fetchKycStatus();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [kycStatus?.kyc_status]);

  const startVerification = async () => {
    try {
      setStarting(true);
      setError(null);
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
          kyc_status: data.mock ? 'approved' : 'started' // se for mock flow, já marcamos aprovado
        }, { merge: true });
      }
      
      if (data.verification_url) {
        // Redirecionar para URL única e criptografada do Didit (expira em 5 mins ou conforme configurado)
        window.location.href = data.verification_url;
      }
    } catch (err: any) {
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

  const isApproved = kycStatus?.kyc_status === 'approved';
  const isDeclined = kycStatus?.kyc_status === 'declined';
  const isPending = kycStatus?.kyc_status === 'started';
  const isReview = kycStatus?.kyc_status === 'review';
  const isNotStarted = !kycStatus || kycStatus.kyc_status === 'not_started';

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
                      Não foi possível aprovar sua documentação na última tentativa. Certifique-se de usar fotos nítidas, em ambiente iluminado e um documento válido (RG ou CNH).
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
                  onClick={startVerification}
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

        {/* State: In Progress / Review */}
        {(isPending || isReview) && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              {isReview ? 'Em Análise Manual' : 'Verificação em Andamento'}
            </h2>
            <p className="text-slate-600 max-w-md mx-auto mb-6">
              {isReview 
                ? 'Sua documentação está passando por uma revisão de segurança final por nossa equipe. Você será notificado em breve.'
                : 'Identificamos que você iniciou o processo. Conclua na janela de segurança enviada ou aguarde a atualização de status nesta tela (atualização automática).'}
            </p>
            
            <div className="inline-flex items-center justify-center px-4 py-2 bg-slate-100 rounded-lg text-sm font-semibold text-slate-700">
              <Loader2 className="w-4 h-4 mr-2 animate-spin text-slate-500" />
              Aguardando provedor KYC...
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
