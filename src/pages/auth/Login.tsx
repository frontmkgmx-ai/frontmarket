import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { Package } from 'lucide-react';
import { AuraBackground } from '../../components/AuraBackground';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  if (user) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative z-10">
      <AuraBackground />
      <div className="max-w-md w-full space-y-8 bg-white/10 backdrop-blur-xl p-8 rounded-2xl border border-white/20 shadow-2xl">
        <div className="text-center">
          <Link to="/" className="mx-auto h-12 w-12 bg-white/20 rounded-full flex items-center justify-center border border-white/30 backdrop-blur-md hover:bg-white/30 transition-colors inline-flex">
            <Package className="h-6 w-6 text-white" />
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Acessar Front MK
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            Ou{' '}
            <Link to="/register" className="font-medium text-teal-300 hover:text-teal-200">
              crie sua conta gratuitamente
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/20 text-red-200 p-3 rounded-md text-sm border border-red-500/30">
              {error}
            </div>
          )}
          <div className="rounded-md space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 bg-white/5 border border-white/20 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm mt-1 backdrop-blur-sm"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 bg-white/5 border border-white/20 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm mt-1 backdrop-blur-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-indigo-950 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
