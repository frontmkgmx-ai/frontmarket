import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useAuthStore } from './store/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { StoreGuard } from './components/StoreGuard';
import { DashboardLayout } from './layouts/DashboardLayout';
import { StorefrontLayout } from './layouts/StorefrontLayout';
import { AuraBackground } from './components/AuraBackground';

import { PlatformLanding } from './pages/PlatformLanding';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { Onboarding } from './pages/admin/Onboarding';
import { Dashboard } from './pages/admin/Dashboard';
import { Categories } from './pages/admin/Categories';
import { Products } from './pages/admin/Products';
import { ProductForm } from './pages/admin/ProductForm';
import { Orders } from './pages/admin/Orders';
import { Customers } from './pages/admin/Customers';
import { Payments } from './pages/admin/Payments';
import { Settings } from './pages/admin/Settings';
import { HomeStore } from './pages/storefront/HomeStore';
import { ProductDetail } from './pages/storefront/ProductDetail';
import { Cart } from './pages/storefront/Cart';
import { Checkout } from './pages/storefront/Checkout';
import { CustomerLogin } from './pages/storefront/CustomerLogin';
import { CustomerRegister } from './pages/storefront/CustomerRegister';

export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const isAdminHost = typeof window !== 'undefined' && window.location.hostname.startsWith('admin.');

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans text-slate-900 antialiased selection:bg-teal-500 selection:text-white">
      <AuraBackground />
      <BrowserRouter>
        <Routes>
          {/* Public Platform Landing or Admin Redirect on admin subdomain */}
          <Route path="/" element={isAdminHost ? <Navigate to="/admin" replace /> : <PlatformLanding />} />

          {/* Platform Auth Routes (For Store Owners) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<Onboarding />} />
            
            {/* Dashboard needs an active store */}
            <Route element={<StoreGuard />}>
              <Route path="/admin" element={<DashboardLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="products" element={<Products />} />
                <Route path="products/new" element={<ProductForm />} />
                <Route path="products/:id/edit" element={<ProductForm />} />
                <Route path="categories" element={<Categories />} />
                <Route path="orders" element={<Orders />} />
                <Route path="customers" element={<Customers />} />
                <Route path="payments" element={<Payments />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>
          </Route>

          {/* Public Storefront Route */}
          <Route path="/:storeSlug" element={<StorefrontLayout />}>
            <Route index element={<HomeStore />} />
            <Route path="p/:productSlug" element={<ProductDetail />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="login" element={<CustomerLogin />} />
            <Route path="register" element={<CustomerRegister />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
