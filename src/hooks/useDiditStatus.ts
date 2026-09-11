import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

export interface UseDiditStatusResult {
  status: string | null;
  loading: boolean;
  error: string | null;
  canWithdraw: boolean;
  refresh: () => Promise<string | null>;
}

/**
 * Hook seguro de monitoramento de KYC (FrontMarket)
 * - Consulta o backend oficial autenticado (/api/user/kyc-status)
 * - Escuta atualizações em tempo real no Firestore sem jamais escrever no banco a partir do cliente
 * - Não possui timers de auto-aprovação (zero bypass)
 */
export function useDiditStatus(): UseDiditStatusResult {
  const [status, setStatus] = useState<string | null>(null);
  const [canWithdraw, setCanWithdraw] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (): Promise<string | null> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setStatus('not_started');
        setCanWithdraw(false);
        setLoading(false);
        return null;
      }

      setLoading(true);
      const token = await currentUser.getIdToken();

      const res = await fetch('/api/user/kyc-status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(`Status query failed: HTTP ${res.status}`);
      }

      const data = await res.json();
      const currentStatus = data.status || 'not_started';

      setStatus(currentStatus);
      setCanWithdraw(Boolean(data.canWithdraw));
      setError(null);
      return currentStatus;
    } catch (err: any) {
      console.warn('[useDiditStatus] Erro ao consultar status KYC no backend:', err.message);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // 1. Escuta em tempo real no Firestore para atualizações vindas de webhooks do backend
  useEffect(() => {
    const targetUid = auth.currentUser?.uid;
    if (!targetUid) {
      setStatus('not_started');
      setCanWithdraw(false);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', targetUid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const firestoreStatus = data?.kyc?.status || data?.kyc_status;
        if (firestoreStatus) {
          const s = firestoreStatus.toLowerCase();
          setStatus(s);
          setCanWithdraw(s === 'approved');
        }
      }
      setLoading(false);
    }, (err) => {
      console.warn('[useDiditStatus] Erro no listener do Firestore:', err.message);
      setLoading(false);
    });

    return () => unsub();
  }, [auth.currentUser?.uid]);

  // 2. Polling seguro com parada imediata em estados terminais
  useEffect(() => {
    fetchStatus();

    const interval = setInterval(async () => {
      const current = await fetchStatus();
      if (current === 'approved' || current === 'declined' || current === 'abandoned') {
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { status, loading, error, canWithdraw, refresh: fetchStatus };
}
