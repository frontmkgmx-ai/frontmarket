import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { SmartLoader } from './SmartLoader';

export function StoreGuard() {
  const { user, activeStore, loading, initialized, profile } = useAuthStore();

  if (!initialized || loading) {
    return <SmartLoader message="Carregando sua loja..." timeoutSeconds={4} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Se o usuário não tem perfil carregado ou não possui loja com nome e slug definidos, redireciona estritamente para onboarding
  const hasValidStore = 
    activeStore && 
    Boolean(activeStore.id) &&
    Boolean(activeStore.name?.trim()) && 
    Boolean(activeStore.slug?.trim()) &&
    Array.isArray(profile?.stores) && 
    profile.stores.length > 0;

  if (!hasValidStore) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
