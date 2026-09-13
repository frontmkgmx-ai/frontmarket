import React from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router';
import { Store } from '../../types';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { CustomerProfileModal } from '../../components/CustomerProfileModal';
import { ArrowLeft, User } from 'lucide-react';

export function CustomerProfile() {
  const { store } = useOutletContext<{ store: Store }>();
  const { customer } = useCustomerAuthStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!customer) {
      navigate(`/${store.slug}/login`);
    }
  }, [customer, store.slug, navigate]);

  if (!customer) return null;

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-8 px-2 sm:px-4">
      <div className="flex items-center gap-3 mb-4">
        <Link
          to={`/${store.slug}`}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-700 shadow-sm border border-black/[0.08] hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C1C1E]">
            Minha Conta & Perfil
          </h1>
          <p className="text-xs text-slate-500">
            Gerencie suas informações, endereço e Chave Pix
          </p>
        </div>
      </div>

      <div className="relative">
        <CustomerProfileModal
          isOpen={true}
          onClose={() => navigate(`/${store.slug}`)}
          store={store}
        />
      </div>
    </div>
  );
}
