import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../lib/utils';
import { 
  Users, 
  Search, 
  Mail, 
  Phone, 
  MessageSquare, 
  ShoppingBag, 
  Calendar,
  X,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  document?: string;
  totalOrders?: number;
  totalSpent?: number;
  createdAt?: any;
  address?: any;
}

export function Customers() {
  const { activeStore } = useAuthStore();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);

  useEffect(() => {
    if (!activeStore) return;

    // Escuta clientes em tempo real
    const q = query(
      collection(db, 'stores', activeStore.id, 'customers'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customersData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as CustomerRecord[];
      setCustomers(customersData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar clientes:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeStore]);

  const filteredCustomers = customers.filter(c => {
    return (
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
    );
  });

  const openWhatsApp = (phone?: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${fullPhone}?text=Olá%20${encodeURIComponent(selectedCustomer?.name || 'Cliente')},%20tudo%20bem?`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header com HUD responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Base de Clientes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Histórico de compradores, dados de contato e engajamento em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          {customers.length} {customers.length === 1 ? 'Cliente Registrado' : 'Clientes Registrados'}
        </div>
      </div>

      {/* Barra de Busca */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Lista de Clientes */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 mt-3">Carregando clientes...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Nenhum cliente cadastrado ainda</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            {search 
              ? 'Nenhum cliente corresponde ao termo buscado.' 
              : 'Assim que novos clientes se cadastrarem ou realizarem compras na sua vitrine, eles aparecerão aqui com dados completos.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tabela em Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">E-mail</th>
                  <th className="py-3.5 px-4">Telefone</th>
                  <th className="py-3.5 px-4">Pedidos</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{customer.name}</div>
                      {customer.document && <div className="text-xs text-slate-400">Doc: {customer.document}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {customer.email}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {customer.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {customer.phone}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Não cadastrado</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <ShoppingBag className="w-3 h-3" />
                        {customer.totalOrders || 1} pedido(s)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedCustomer(customer)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                      >
                        Ver Perfil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards em Mobile */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredCustomers.map((customer) => (
              <div key={customer.id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900">{customer.name}</div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                    <ShoppingBag className="w-3 h-3" />
                    {customer.totalOrders || 1} pedido(s)
                  </span>
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {customer.email}
                  </div>
                  {customer.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {customer.phone}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedCustomer(customer)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                >
                  Ver Detalhes do Cliente
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Cliente */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-base">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedCustomer.name}</h3>
                  <p className="text-xs text-slate-500">{selectedCustomer.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-400 block">Telefone</span>
                  <strong className="text-slate-800">{selectedCustomer.phone || 'Não informado'}</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-400 block">CPF/CNPJ</span>
                  <strong className="text-slate-800">{selectedCustomer.document || 'Não informado'}</strong>
                </div>
              </div>

              {selectedCustomer.phone && (
                <button
                  onClick={() => openWhatsApp(selectedCustomer.phone)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  Conversar no WhatsApp
                </button>
              )}

              {selectedCustomer.address && (
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Endereço Principal
                  </span>
                  <p className="text-slate-800 text-xs leading-relaxed">
                    {selectedCustomer.address.street}, Nº {selectedCustomer.address.number}
                    <br />
                    {selectedCustomer.address.neighborhood} - {selectedCustomer.address.city}/{selectedCustomer.address.state}
                    <br />
                    CEP: {selectedCustomer.address.zipcode}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
