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
      return;
    }
    
    try {
      setLoading(true);
      
      let finalStatus = null;
      let finalDocData = null;

      // 1. Tentar ler do Webhook KV (Cloudflare) via vendorData
      if (vendorData) {
        const resKV = await fetch(`/api/webhooks/didit?vendor_data=${encodeURIComponent(vendorData)}`);
        if (resKV.ok) {
          const textKV = await resKV.text();
          if (textKV) {
            const dataKV = JSON.parse(textKV);
            if (Object.keys(dataKV).length > 0) {
              finalStatus = dataKV.status || null;
              finalDocData = dataKV.document_data || null;
            }
          }
        }
      }

      // 2. Se não encontrou no KV, faz o Polling Direto na API da Didit via session_id da URL
      const currentSessionId = sessionIdToPoll || urlSessionId;
      if (!finalStatus && currentSessionId) {
        const resAPI = await fetch(`/api/user/kyc-status?session_id=${currentSessionId}`);
        if (resAPI.ok) {
          const dataAPI = await resAPI.json();
          if (dataAPI && dataAPI.status) {
            finalStatus = dataAPI.status;
            // Atualiza no banco de dados Firestore
            if (vendorData) {
              try {
                await updateDoc(doc(db, 'users', vendorData), {
                  kyc_status: finalStatus,
                  kyc_session_id: currentSessionId
                });
              } catch (e) {
                console.warn('Erro ao sincronizar status no Firestore', e);
              }
            }
          }
        }
      }

      setStatus(finalStatus);
      if (finalDocData) setDocumentData(finalDocData);
      setError(null);
      
      return finalStatus;
    } catch (err: any) {
      setError(err.message);
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
    
    // Polling a cada 5 segundos para atualizar status em tempo real
    const interval = setInterval(async () => {
      const currentStatus = await fetchStatus();
      // Se já aprovou ou recusou, pode parar o polling
      if (currentStatus === 'approved' || currentStatus === 'declined') {
        clearInterval(interval);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { status, documentData, loading, error, refresh: fetchStatus };
}
