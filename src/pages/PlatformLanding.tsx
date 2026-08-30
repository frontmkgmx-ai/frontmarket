import { Link, Navigate } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { Package, Store, ShoppingBag, CreditCard, LayoutDashboard, ArrowRight } from 'lucide-react';

export function PlatformLanding() {
  const { user } = useAuthStore();

  // Se o lojista já estiver logado, redireciona para o admin
  if (user) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900 tracking-tight">Front MK</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 hidden sm:block">
              Já sou lojista
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
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
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-8">
              A plataforma definitiva <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                para sua loja virtual
              </span>
            </h1>
            <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto mb-10">
              Crie, gerencie e escale seu e-commerce com o Front MK. Tudo que você precisa para vender online de forma profissional, sem complicações.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all"
              >
                Começar gratuitamente
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border-2 border-gray-200 text-lg font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-all"
              >
                Acessar painel
              </Link>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="bg-gray-50 py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900">Tudo para o seu negócio crescer</h2>
              <p className="mt-4 text-lg text-gray-600">Recursos poderosos e fáceis de usar.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                  <Store className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Vitrine Personalizada</h3>
                <p className="text-gray-600">Sua loja com a sua cara. Catálogo público rápido, otimizado para vendas e acessível de qualquer dispositivo.</p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-6">
                  <ShoppingBag className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Gestão de Produtos</h3>
                <p className="text-gray-600">Venda produtos físicos ou digitais. Controle de estoque, variações, categorias e galeria de imagens simplificada.</p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                  <LayoutDashboard className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Dashboard Completo</h3>
                <p className="text-gray-600">Acompanhe seus pedidos, faturamento e clientes em tempo real através de um painel administrativo poderoso.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500">
          <p>© {new Date().getFullYear()} Front MK SaaS. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
