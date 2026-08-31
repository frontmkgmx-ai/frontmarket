import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

// Busca o status KYC atualizado via webhook do usuário, banco de dados ou polling direto
export function useDiditStatus(vendorData?: string) {
  const [status, setStatus] = useState<string | null>(null);
  const [documentData, setDocumentData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Lê session_id da URL (caso retorne do redirect callback da Didit)
  const queryParams = new URLSearchParams(window.location.search);
  const urlSessionId = queryParams.get('session_id');

  const fetchStatus = useCallback(async (sessionIdToPoll?: string) => {
    if (!vendorData && !sessionIdToPoll) {
      setLoading(false);
      return null;
    }
    
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (vendorData) params.set('vendor_data', vendorData);
      
      const currentSessionId = sessionIdToPoll || urlSessionId;
      if (currentSessionId) params.set('session_id', currentSessionId);

      const resAPI = await fetch(`/api/didit/session?${params.toString()}`);
      
      if (!resAPI.ok) {
        throw new Error(`HTTP error ${resAPI.status}`);
      }
      
      const dataAPI = await resAPI.json();
      
      let finalStatus = 'pending';
      let finalDocData = null;

      if (dataAPI) {
        if (dataAPI.api_error) {
          console.error('Erro na API da Didit:', dataAPI.api_error);
          // O status já deve vir como fallback "pending" se houver erro da API, mas garantimos aqui:
          finalStatus = dataAPI.status || 'pending';
        } else if (dataAPI.status) {
          finalStatus = dataAPI.status;
        }

        if (dataAPI.document_data) {
          finalDocData = dataAPI.document_data;
        }
      }

      // Sincroniza com o Firestore
      if (vendorData && finalStatus) {
        try {
          const updatePayload: any = {
            kyc_status: finalStatus,
          };
          if (currentSessionId) updatePayload.kyc_session_id = currentSessionId;
          
          await updateDoc(doc(db, 'users', vendorData), updatePayload);
        } catch (e) {
          console.warn('Erro ao sincronizar status no Firestore', e);
        }
      }

      setStatus(finalStatus);
      if (finalDocData) setDocumentData(finalDocData);
      setError(null);
      
      return finalStatus;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [vendorData, urlSessionId]);

  // Efeito 1: Firestore Realtime Listener
  useEffect(() => {
    if (!vendorData) return;
    const unsub = onSnapshot(doc(db, 'users', vendorData), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.kyc_status && data.kyc_status !== status) {
          setStatus(data.kyc_status);
        }
      }
    });
    return () => unsub();
  }, [vendorData, status]);

  // Efeito 2: Polling da API
  useEffect(() => {
    fetchStatus();
    
    // Polling a cada 4 segundos para atualizar status em tempo real
    const interval = setInterval(async () => {
      const currentStatus = await fetchStatus();
      // Se já aprovou ou recusou, pode parar o polling
      if (currentStatus === 'approved' || currentStatus === 'declined') {
        clearInterval(interval);
      }
    }, 4000);
    
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { status, documentData, loading, error, refresh: fetchStatus };
}
