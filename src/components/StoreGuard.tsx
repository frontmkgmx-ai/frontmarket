import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../store/authStore';

export function StoreGuard() {
  const { activeStore, loading, initialized, profile } = useAuthStore();

  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // If logged in but no store created yet, force them to create one
  if (profile && (!activeStore || !profile.stores || profile.stores.length === 0)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
