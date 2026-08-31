import { Outlet, Link, useNavigate, useLocation } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  Settings, 
  LogOut, 
  Package, 
  CreditCard, 
  Menu, 
  X,
  ExternalLink,
  Store as StoreIcon,
  Layers,
  ShieldCheck,
  Palette
} from 'lucide-react';

import { useState } from 'react';

export function DashboardLayout() {
  const { activeStore, profile, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const kycStatusLower = (profile?.kyc_status || '').toLowerCase();
  const verificationStatusLower = ((profile as any)?.verification_status || '').toLowerCase();
  const isKycApproved = (profile as any)?.verified === true ||
    kycStatusLower === 'approved' || kycStatusLower === 'completed' || kycStatusLower === 'verified' || kycStatusLower === 'success' ||
    verificationStatusLower === 'approved' || verificationStatusLower === 'completed' || verificationStatusLower === 'verified';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { name: 'Pedidos', icon: ShoppingBag, path: '/admin/orders' },
    { name: 'Produtos', icon: Package, path: '/admin/products' },
    { name: 'Categorias', icon: Layers, path: '/admin/categories' },
    { name: 'Clientes', icon: Users, path: '/admin/customers' },
    { name: 'Gateways', icon: CreditCard, path: '/admin/gateways' },
    { name: 'Domínios', icon: ExternalLink, path: '/admin/domains' },
    { name: 'Verificação', icon: ShieldCheck, path: '/admin/verification' },
    { name: 'Personalização', icon: Palette, path: '/admin/personalization' },
    { name: 'Configurações', icon: Settings, path: '/admin/settings' },
  ];

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Mobile sidebar backdrop overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand / Store Info */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
              <StoreIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate leading-tight">
                {activeStore?.name || 'Front MK'}
              </h1>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                /{activeStore?.slug || ''}
              </p>
            </div>
          </div>

          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="p-1 text-slate-400 hover:text-white lg:hidden rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick link to Storefront */}
        {activeStore && (
          <div className="px-3 pt-3">
            <a
              href={`/${activeStore.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-3 py-2 text-xs font-medium text-indigo-200 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800/50 rounded-lg transition-colors"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                Ver Vitrine Online
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </a>
          </div>
        )}
        
        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== '/admin' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/20'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 mr-3 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate flex-1">{item.name}</span>
                {item.name === 'Verificação' && isKycApproved && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-emerald-500 text-white' : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                  }`}>
                    Ativo
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Footer & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 shrink-0">
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center w-full px-3 py-2.5 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Encerrar Sessão
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-slate-800 text-base truncate">
                {activeStore?.name || 'Painel de Controle'}
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Online
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {activeStore && (
              <a
                href={`/${activeStore.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Acessar Loja</span>
              </a>
            )}
          </div>
        </header>

        {/* Scrollable Page Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/60">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
