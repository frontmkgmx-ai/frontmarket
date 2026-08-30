import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { SmartLoader } from './SmartLoader';

export function ProtectedRoute() {
  const { user, loading, initialized } = useAuthStore();

  if (!initialized || loading) {
    return <SmartLoader message="Verificando credenciais..." timeoutSeconds={4} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
