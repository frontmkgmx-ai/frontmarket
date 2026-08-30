import { useState } from 'react';

interface UseDiditKYCResult {
  sessionUrl: string | null;
  loading: boolean;
  error: string | null;
  startKYC: (workflowId?: string) => Promise<void>;
}

export function useDiditKYC(token: string | null): UseDiditKYCResult {
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const startKYC = async (workflowId?: string) => {
    if (!token) {
      setError('Usuário não autenticado.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      
      // Chamamos o nosso backend/Cloudflare Function em vez de chamar a API Didit
      // diretamente, para não expor a DIDIT_API_KEY no navegador.
      const response = await fetch(`${apiUrl}/api/user/start-kyc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ workflowId })
      });

      const text = await response.text();

      if (!text) {
        throw new Error(`Resposta vazia do servidor (status: ${response.status})`);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Resposta inválida: ${text.substring(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${data?.error || data?.message || data?.detail || text}`);
      }

      if (data.verification_url) {
        setSessionUrl(data.verification_url);
      } else {
        throw new Error('URL de verificação não encontrada na resposta.');
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao iniciar a verificação KYC.');
    } finally {
      setLoading(false);
    }
  };

  return { sessionUrl, loading, error, startKYC };
}
