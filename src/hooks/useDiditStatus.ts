import { useState, useEffect, useCallback } from 'react';

// Busca o status KYC atualizado via webhook do usuário
export function useDiditStatus(vendorData?: string) {
  const [status, setStatus] = useState<string | null>(null);
  const [documentData, setDocumentData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!vendorData) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/webhooks/didit?vendor_data=${encodeURIComponent(vendorData)}`);
      
      if (!res.ok) {
        throw new Error(`Erro: ${res.status}`);
      }

      const text = await res.text();
      if (!text) {
        // Sem dados salvos ainda
        setStatus(null);
        setDocumentData(null);
        setError(null);
        return;
      }
      
      const data = JSON.parse(text);
      if (Object.keys(data).length === 0) {
        setStatus(null);
        setDocumentData(null);
      } else {
        setStatus(data.status || null);
        setDocumentData(data.document_data || null);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [vendorData]);

  useEffect(() => {
    fetchStatus();
    // Polling a cada 10 segundos para atualizar status em tempo real
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { status, documentData, loading, error, refresh: fetchStatus };
}
