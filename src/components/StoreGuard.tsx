import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { SmartLoader } from './SmartLoader';

export function StoreGuard() {
  const { activeStore, loading, initialized, profile } = useAuthStore();

  if (!initialized || loading) {
    return <SmartLoader message="Carregando sua loja..." timeoutSeconds={4} />;
  }

  // Se o usuário está logado mas ainda não tem nenhuma loja criada, vai para onboarding
  if (profile && (!activeStore || !profile.stores || profile.stores.length === 0)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
