import React, { useState, useEffect } from 'react';
import { Camera, AlertTriangle, Loader2 } from 'lucide-react';
import { useDiditKYC } from '../hooks/useDiditKYC';

interface KYCButtonProps {
  token: string | null;
  workflowId?: string;
}

export function KYCButton({ token, workflowId }: KYCButtonProps) {
  const { sessionUrl, loading, error: kycError, startKYC } = useDiditKYC(token);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Se a URL for recebida com sucesso, redireciona quebrando o Iframe
  useEffect(() => {
    if (sessionUrl) {
      if (window.top) {
        window.top.location.href = sessionUrl;
      } else {
        window.location.href = sessionUrl;
      }
    }
  }, [sessionUrl]);

  const handleStart = async (forceStart: boolean = false) => {
    setCameraError(null);

    // Só checa a câmera se não for bypass (bypass = true significa ignorar bloqueio local)
    if (!forceStart) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Seu navegador não possui suporte para captura de vídeo pela câmera.');
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Libera a câmera temporária após a permissão ser concedida
        stream.getTracks().forEach(track => track.stop());
      } catch (camErr: any) {
        if (camErr.name === 'NotAllowedError' || camErr.name === 'PermissionDeniedError') {
          setCameraError('Permissão negada. Clique no cadeado na barra de endereço e autorize a câmera.');
          return;
        } else if (camErr.name === 'NotFoundError' || camErr.name === 'DevicesNotFoundError') {
          setCameraError('Nenhuma câmera detectada. Conecte uma câmera para continuar.');
          return;
        } else {
          setCameraError('Não foi possível acessar a câmera: ' + (camErr.message || 'Erro desconhecido'));
          return;
        }
      }
    }

    // Passou na verificação da câmera (ou forçou), inicia o KYC no backend
    await startKYC(workflowId);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Exibe erro da Câmera ou da API */}
      {(cameraError || kycError) && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            Falha na Verificação
          </div>
          <p>{cameraError || kycError}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => handleStart(false)}
          disabled={loading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm hover:shadow transition-all disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Solicitando sessão...
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              Permitir Câmera e Iniciar Verificação
            </>
          )}
        </button>

        {/* Botão de Bypass que só aparece se a câmera falhar preventivamente */}
        {cameraError && (
          <button
            type="button"
            onClick={() => handleStart(true)}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm hover:shadow transition-all disabled:opacity-60"
          >
            Forçar abertura
          </button>
        )}
      </div>
    </div>
  );
}
