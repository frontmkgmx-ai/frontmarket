import React, { useEffect, useState } from 'react';
import { RefreshCw, WifiOff, ArrowRight } from 'lucide-react';

interface SmartLoaderProps {
  message?: string;
  timeoutSeconds?: number;
  onRetry?: () => void;
  fullScreen?: boolean;
}

export function SmartLoader({
  message = 'Carregando dados...',
  timeoutSeconds = 4,
  onRetry,
  fullScreen = true
}: SmartLoaderProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isSlow, setIsSlow] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= 2.5) setIsSlow(true);
        if (next >= timeoutSeconds) setIsTimedOut(true);
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeoutSeconds]);

  const handleReload = () => {
    if (onRetry) {
      setElapsed(0);
      setIsSlow(false);
      setIsTimedOut(false);
      onRetry();
    } else {
      window.location.reload();
    }
  };

  const content = (
    <div className="flex flex-col items-center justify-center text-center p-6 max-w-sm mx-auto animate-in fade-in duration-300">
      {/* Animated Spinner or Warning Icon */}
      {!isTimedOut ? (
        <div className="relative mb-5">
          <div className="w-12 h-12 rounded-full border-3 border-indigo-100 border-t-indigo-600 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping opacity-75"></span>
          </div>
        </div>
      ) : (
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-5 shadow-xs">
          <WifiOff className="w-6 h-6 animate-pulse" />
        </div>
      )}

      {/* Message Heading */}
      <h3 className="text-base font-semibold text-slate-800 mb-1">
        {isTimedOut ? 'A conexão está instável' : message}
      </h3>

      {/* Helper text based on elapsed time */}
      <p className="text-xs text-slate-500 mb-5 leading-relaxed">
        {isTimedOut
          ? 'O servidor demorou mais que o esperado para responder. Você pode tentar recarregar ou continuar.'
          : isSlow
          ? 'Otimizando sua conexão e sincronizando dados...'
          : 'Aguarde um instante enquanto preparamos seu ambiente.'}
      </p>

      {/* Action Buttons if slow or timed out */}
      {(isSlow || isTimedOut) && (
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
          <button
            onClick={handleReload}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar Novamente
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-slate-600 hover:text-slate-900 text-xs font-medium rounded-xl hover:bg-slate-100 transition-colors"
          >
            Página Inicial
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );

  if (!fullScreen) {
    return <div className="py-12 w-full">{content}</div>;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/80 backdrop-blur-xs">
      {content}
    </div>
  );
}
