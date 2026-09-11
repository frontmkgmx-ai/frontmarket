import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { Customer } from '../../types';
import { formatCurrency, maskCPF, maskPhone } from '../../lib/utils';
import { 
  Users, 
  Search, 
  Mail, 
  Phone, 
  MessageSquare, 
  ShoppingBag, 
  X,
  ShieldCheck,
  UserCheck,
  MapPin,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  Filter,
  ArrowUpDown,
  Sparkles,
  User
} from 'lucide-react';
import { FastCache } from '../../lib/cache';

type FilterType = 'all' | 'with_orders' | 'with_phone' | 'with_address';
type SortType = 'recent' | 'name_asc' | 'orders_desc';

export function Customers() {
  const { activeStore } = useAuthStore();
  const cacheKey = activeStore?.id ? `store_customers_${activeStore.id}` : '';
  
  const [customers, setCustomers] = useState<Customer[]>(() => {
    return (cacheKey && FastCache.get(cacheKey)) || [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return cacheKey ? !FastCache.get(cacheKey) : true;
  });

  // Filtros e Busca Inteligente
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('recent');
  
  // Cliente selecionado para ficha detalhada
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  useEffect(() => {
    if (!activeStore?.id) {
      setLoading(false);
      return;
    }

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    // Escuta em tempo real os clientes cadastrados nesta loja
    const q = query(
      collection(db, 'stores', activeStore.id, 'customers'),
      // orderBy('createdAt', 'desc') - removido para evitar falha de indexação mista
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      clearTimeout(safetyTimer);
      const customersData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Customer[];
      setCustomers(customersData);
      if (cacheKey) FastCache.set(cacheKey, customersData);
      setLoading(false);
    }, (error) => {
      clearTimeout(safetyTimer);
      console.warn("Aviso ao carregar clientes da loja:", error);
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [activeStore?.id, cacheKey]);

  // Busca e Filtros Inteligentes
  const filteredAndSortedCustomers = useMemo(() => {
    let result = customers.filter(c => {
      const term = search.toLowerCase().trim();
      const matchSearch = !term || (
        c.name?.toLowerCase().includes(term) ||
        c.username?.toLowerCase().includes(term) ||
        c.cpf?.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.address?.city?.toLowerCase().includes(term) ||
        c.address?.state?.toLowerCase().includes(term)
      );

      if (!matchSearch) return false;

      if (activeFilter === 'with_orders') {
        return (c.totalOrders || 0) > 0;
      }
      if (activeFilter === 'with_phone') {
        return Boolean(c.phone && c.phone.trim().length > 5);
      }
      if (activeFilter === 'with_address') {
        return Boolean(c.address?.street && c.address?.city);
      }

      return true;
    });

    // Ordenação
    result.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'orders_desc') {
        return (b.totalOrders || 0) - (a.totalOrders || 0);
      }
      // recent
      const getMs = (val: any) => typeof val?.toDate === 'function' ? val.toDate().getTime() : (val?.seconds ? val.seconds * 1000 : new Date(val || 0).getTime());
      const dateA = getMs(a.createdAt);
      const dateB = getMs(b.createdAt);
      return dateB - dateA;
    });

    return result;
  }, [customers, search, activeFilter, sortBy]);

  // Estatísticas Rápidas
  const stats = useMemo(() => {
    const total = customers.length;
    const withOrders = customers.filter(c => (c.totalOrders || 0) > 0).length;
    const withWhatsApp = customers.filter(c => c.phone && c.phone.replace(/\D/g, '').length >= 10).length;
    return { total, withOrders, withWhatsApp };
  }, [customers]);

  const openWhatsApp = (phone?: string, name?: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(
      `https://wa.me/${fullPhone}?text=Ol%C3%A1%20${encodeURIComponent(name || 'Cliente')}%2C%20tudo%20bem%3F%20Falamos%20da%20loja%20${encodeURIComponent(activeStore?.name || '')}`,
      '_blank'
    );
  };

  const copyToClipboard = (text: string, type: 'id' | 'address') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header HUD - Totalmente Responsivo para Mobile e Desktop */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600 shrink-0" />
            <span>Clientes da Loja</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Contas individuais de clientes criadas exclusivamente na sua loja
          </p>
        </div>

        {/* Indicadores de Clientes */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>{stats.total} {stats.total === 1 ? 'Cliente' : 'Clientes'}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-bold">
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
            <span>{stats.withOrders} Compradores</span>
          </div>
        </div>
      </div>

      {/* Barra de Busca Inteligente & Filtros */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Input de Busca Universal */}
          <div className="relative flex-grow">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscador Inteligente: Nome, @usuario, CPF, WhatsApp, Cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Ordenação */}
          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              aria-label="Ordenar clientes"
              className="w-full sm:w-auto py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="recent">Mais Recentes</option>
              <option value="name_asc">Nome (A - Z)</option>
              <option value="orders_desc">Mais Pedidos</option>
            </select>
          </div>
        </div>

        {/* Pílulas de Filtros Rápidos */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Filtros:
          </span>
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({customers.length})
          </button>
          <button
            onClick={() => setActiveFilter('with_orders')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'with_orders'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Com Pedidos ({stats.withOrders})
          </button>
          <button
            onClick={() => setActiveFilter('with_phone')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'with_phone'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Com WhatsApp ({stats.withWhatsApp})
          </button>
          <button
            onClick={() => setActiveFilter('with_address')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'with_address'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Com Endereço Cadastrado
          </button>
        </div>
      </div>

      {/* Lista Inteligente de Clientes */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-sm">
          <div className="inline-block w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs sm:text-sm text-slate-500 mt-3 font-medium">Buscando clientes da loja...</p>
        </div>
      ) : filteredAndSortedCustomers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-2xs">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Nenhum cliente encontrado</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {search 
              ? 'Nenhum cliente corresponde aos termos ou filtros selecionados.' 
              : 'Assim que novos clientes se cadastrarem com usuário e senha na sua vitrine, eles aparecerão organizados aqui.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
          
          {/* VISUALIZAÇÃO DESKTOP: TABELA INTELIGENTE */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-4 px-6">Cliente & Usuário</th>
                  <th className="py-4 px-6">Documento (CPF)</th>
                  <th className="py-4 px-6">Contato & WhatsApp</th>
                  <th className="py-4 px-6">Localidade</th>
                  <th className="py-4 px-6 text-center">Compras</th>
                  <th className="py-4 px-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAndSortedCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center shrink-0">
                          {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{c.name || 'Cliente Sem Nome'}</div>
                          <div className="text-xs text-slate-400 font-mono flex items-center gap-1">
                            <span>@{c.username}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="text-xs font-mono text-slate-600 font-medium">
                        {c.cpf || <span className="text-slate-400 italic">Não informado</span>}
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        {c.phone ? (
                          <button
                            onClick={() => openWhatsApp(c.phone, c.name)}
                            className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{c.phone}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Sem telefone</span>
                        )}
                        {c.email && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[160px]">{c.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      {c.address?.city ? (
                        <div className="text-xs text-slate-700">
                          <span className="font-semibold">{c.address.city}</span>
                          {c.address.state && <span className="text-slate-400"> / {c.address.state}</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <ShoppingBag className="w-3 h-3" />
                        {c.totalOrders || 0} pedido(s)
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedCustomer(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all cursor-pointer"
                      >
                        Ver Ficha
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* VISUALIZAÇÃO MOBILE: CARDS INTELIGENTES */}
          <div className="lg:hidden divide-y divide-slate-100">
            {filteredAndSortedCustomers.map((c) => (
              <div key={c.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">{c.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">@{c.username}</div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 shrink-0">
                    <ShoppingBag className="w-2.5 h-2.5" />
                    {c.totalOrders || 0} pedido(s)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">CPF</span>
                    <span className="font-mono text-slate-700 text-[11px]">{c.cpf || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Cidade</span>
                    <span className="text-slate-700 text-[11px] truncate block">
                      {c.address?.city ? `${c.address.city}/${c.address.state || ''}` : 'Não informada'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {c.phone ? (
                    <button
                      onClick={() => openWhatsApp(c.phone, c.name)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition-colors cursor-pointer border border-emerald-200/60"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp</span>
                    </button>
                  ) : null}

                  <button
                    onClick={() => setSelectedCustomer(c)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors cursor-pointer border border-indigo-200/60"
                  >
                    <span>Ficha Completa</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL INTELIGENTE: FICHA COMPLETA DO CLIENTE */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header da Ficha */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center text-lg shadow-md shadow-indigo-500/20">
                  {selectedCustomer.name?.charAt(0).toUpperCase() || 'C'}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base sm:text-lg">{selectedCustomer.name}</h3>
                  <p className="text-xs text-indigo-600 font-mono font-semibold">@{selectedCustomer.username}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo da Ficha */}
            <div className="p-4 sm:p-6 space-y-4 text-xs sm:text-sm">
              
              {/* Bloco 1: Acesso e Identificação */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">CPF do Cliente</span>
                  <strong className="text-slate-900 font-mono text-xs">{selectedCustomer.cpf || 'Não cadastrado'}</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Total de Pedidos</span>
                  <strong className="text-indigo-700 font-bold text-xs">{selectedCustomer.totalOrders || 0} pedido(s)</strong>
                </div>
              </div>

              {/* Bloco 2: Contatos */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Contatos do Cliente</span>
                <div className="flex flex-col sm:flex-row gap-2">
                  {selectedCustomer.phone && (
                    <button
                      onClick={() => openWhatsApp(selectedCustomer.phone, selectedCustomer.name)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Chamar no WhatsApp ({selectedCustomer.phone})
                    </button>
                  )}
                  {selectedCustomer.email && (
                    <a
                      href={`mailto:${selectedCustomer.email}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Enviar E-mail
                    </a>
                  )}
                </div>
              </div>

              {/* Bloco 3: Endereço Completo */}
              {selectedCustomer.address && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      Endereço de Entrega
                    </span>
                    <button
                      onClick={() => {
                        const addr = `${selectedCustomer.address?.street}, ${selectedCustomer.address?.number} - ${selectedCustomer.address?.neighborhood}, ${selectedCustomer.address?.city}/${selectedCustomer.address?.state} - CEP ${selectedCustomer.address?.zipcode}`;
                        copyToClipboard(addr, 'address');
                      }}
                      className="text-[11px] font-semibold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedAddress ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedAddress ? 'Copiado!' : 'Copiar Endereço'}</span>
                    </button>
                  </div>
                  <p className="text-slate-800 text-xs leading-relaxed">
                    <strong>{selectedCustomer.address.street}</strong>, Nº <strong>{selectedCustomer.address.number || 'S/N'}</strong>
                    {selectedCustomer.address.complement && <span> ({selectedCustomer.address.complement})</span>}
                    <br />
                    Bairro: {selectedCustomer.address.neighborhood}
                    <br />
                    Cidade: {selectedCustomer.address.city} - {selectedCustomer.address.state}
                    <br />
                    <span className="font-mono text-slate-500">CEP: {selectedCustomer.address.zipcode}</span>
                  </p>
                </div>
              )}

              {/* ID de Registro & Data */}
              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-mono">ID: {selectedCustomer.id}</span>
                <span>Cliente exclusivo da loja</span>
              </div>
            </div>

            {/* Rodapé da Ficha */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2 text-xs sm:text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
