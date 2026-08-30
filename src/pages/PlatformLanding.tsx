import { Link, Navigate } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { Package, Store, ShoppingBag, LayoutDashboard, ArrowRight } from 'lucide-react';
import { AuraBackground } from '../components/AuraBackground';

export function PlatformLanding() {
  const { user } = useAuthStore();

  if (user) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen text-white relative">
      <AuraBackground />
      
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-500/20 p-2 rounded-lg backdrop-blur-sm border border-indigo-500/30">
              <Package className="w-6 h-6 text-indigo-300" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Front MK</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-gray-300 hover:text-white hidden sm:block transition-colors">
              Já sou lojista
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-5 py-2.5 border border-white/10 text-sm font-medium rounded-xl text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
            >
              Criar minha loja
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <div className="relative pt-20 pb-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 text-white drop-shadow-2xl">
              A plataforma definitiva <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-indigo-300 to-purple-300 drop-shadow-lg">
                para sua loja virtual
              </span>
            </h1>
            <p className="mt-4 text-xl text-gray-300 max-w-2xl mx-auto mb-10 drop-shadow-md">
              Crie, gerencie e escale seu e-commerce com o Front MK. Tudo que você precisa para vender online de forma profissional, sem complicações.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border border-white/20 text-lg font-medium rounded-xl text-indigo-950 bg-white hover:bg-gray-100 shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] transition-all"
              >
                Começar gratuitamente
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border border-white/20 text-lg font-medium rounded-xl text-white bg-black/30 hover:bg-black/50 backdrop-blur-md transition-all"
              >
                Acessar painel
              </Link>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="py-24 relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white drop-shadow-lg">Tudo para o seu negócio crescer</h2>
              <p className="mt-4 text-lg text-gray-300">Recursos poderosos e fáceis de usar.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white/5 backdrop-blur-lg p-8 rounded-2xl border border-white/10 shadow-2xl hover:bg-white/10 transition-colors">
                <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-6 border border-indigo-500/30">
                  <Store className="w-6 h-6 text-indigo-300" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Vitrine Personalizada</h3>
                <p className="text-gray-300 leading-relaxed">Sua loja com a sua cara. Catálogo público rápido, otimizado para vendas e acessível de qualquer dispositivo.</p>
              </div>

              <div className="bg-white/5 backdrop-blur-lg p-8 rounded-2xl border border-white/10 shadow-2xl hover:bg-white/10 transition-colors">
                <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center mb-6 border border-teal-500/30">
                  <ShoppingBag className="w-6 h-6 text-teal-300" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Gestão de Produtos</h3>
                <p className="text-gray-300 leading-relaxed">Venda produtos físicos ou digitais. Controle de estoque, variações, categorias e galeria de imagens simplificada.</p>
              </div>

              <div className="bg-white/5 backdrop-blur-lg p-8 rounded-2xl border border-white/10 shadow-2xl hover:bg-white/10 transition-colors">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-6 border border-purple-500/30">
                  <LayoutDashboard className="w-6 h-6 text-purple-300" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Dashboard Completo</h3>
                <p className="text-gray-300 leading-relaxed">Acompanhe seus pedidos, faturamento e clientes em tempo real através de um painel administrativo poderoso.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-12 border-t border-white/10 bg-black/20 backdrop-blur-sm mt-auto relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400">
          <p>© {new Date().getFullYear()} Front MK SaaS. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
