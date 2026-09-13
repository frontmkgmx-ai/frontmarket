import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, AlertCircle, ShoppingBag, Loader2, Plus, Trash2, Edit3, Save, X } from 'lucide-react';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { Product } from '../../types';
import { uploadFileToStreamx } from '../../lib/streamx';

interface TemplateConfig {
  logoUrl: string;
  primaryColor: string;
  backgroundColor: string;
  footerText: string;
}

interface StatusEmails {
  paid: { enabled: boolean; subject: string; body: string };
  refunded: { enabled: boolean; subject: string; body: string };
  canceled: { enabled: boolean; subject: string; body: string };
}

interface ProductEmail {
  id: string;
  productId: string;
  subject: string;
  body: string;
  enabled: boolean;
}

const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  logoUrl: '',
  primaryColor: '#4f46e5',
  backgroundColor: '#f8fafc',
  footerText: '© {{store_name}}. Todos os direitos reservados.'
};

const DEFAULT_STATUS_EMAILS: StatusEmails = {
  paid: {
    enabled: true,
    subject: 'Pagamento Aprovado - {{store_name}}',
    body: 'Olá {{customer_name}},\n\nSeu pagamento do pedido #{{order_id}} no valor de {{total_amount}} foi aprovado com sucesso!\n\nEm breve enviaremos mais atualizações sobre a entrega.\n\nObrigado por comprar conosco!'
  },
  refunded: {
    enabled: true,
    subject: 'Reembolso Processado - {{store_name}}',
    body: 'Olá {{customer_name}},\n\nO reembolso do seu pedido #{{order_id}} no valor de {{total_amount}} foi processado.\n\nO valor deve constar na sua conta em breve.'
  },
  canceled: {
    enabled: true,
    subject: 'Pedido Cancelado - {{store_name}}',
    body: 'Olá {{customer_name}},\n\nInfelizmente seu pedido #{{order_id}} foi cancelado.\n\nSe tiver dúvidas, entre em contato com nosso suporte.'
  }
};

export function EmailsConfig() {
  const { activeStore } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'products' | 'template'>('status');
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig>(DEFAULT_TEMPLATE_CONFIG);

  const [statusEmails, setStatusEmails] = useState<StatusEmails>(DEFAULT_STATUS_EMAILS);
  const [productEmails, setProductEmails] = useState<ProductEmail[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // State for adding/editing product emails
  const [editingProductEmail, setEditingProductEmail] = useState<ProductEmail | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    setUploadingLogo(true);
    try {
      const url = await uploadFileToStreamx(e.target.files[0]);
      setTemplateConfig(prev => ({ ...prev, logoUrl: url }));
    } catch (err) {
      console.error(err);
      alert('Erro ao fazer upload da logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  useEffect(() => {
    if (!activeStore?.id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Load Settings
        const settingsRef = doc(db, 'stores', activeStore.id, 'settings', 'emails');
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.statusEmails) setStatusEmails(data.statusEmails);
          if (data.productEmails) setProductEmails(data.productEmails);
          if (data.templateConfig) setTemplateConfig(data.templateConfig);
        }

        // Load Products for selection
        const prodsSnap = await getDocs(collection(db, 'stores', activeStore.id, 'products'));
        const prodsData = prodsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
        setProducts(prodsData);
      } catch (err) {
        console.error('Erro ao carregar configurações de e-mail:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeStore]);

  const handleSaveAll = async () => {
    if (!activeStore?.id) return;
    setSaving(true);
    setSuccess(false);

    try {
      const settingsRef = doc(db, 'stores', activeStore.id, 'settings', 'emails');
      await setDoc(settingsRef, {
        statusEmails,
        productEmails,
        templateConfig,
        updatedAt: new Date()
      }, { merge: true });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Erro ao salvar:', err);
    } finally {
      setSaving(false);
    }
  };

  const saveProductEmailForm = () => {
    if (!editingProductEmail) return;
    
    if (!editingProductEmail.productId) {
      alert("Selecione um produto.");
      return;
    }

    if (isAddingProduct) {
      setProductEmails([...productEmails, { ...editingProductEmail, id: Math.random().toString(36).substring(7) }]);
    } else {
      setProductEmails(productEmails.map(p => p.id === editingProductEmail.id ? editingProductEmail : p));
    }
    
    setEditingProductEmail(null);
    setIsAddingProduct(false);
  };

  const [testingEmail, setTestingEmail] = useState<string | null>(null);

  const handleTestTemplate = async (subject: string, body: string, key: string) => {
    if (!activeStore?.id) return;
    setTestingEmail(key);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/stores/${activeStore.id}/test-email-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subject, body })
      });
      if (res.ok) {
        alert('E-mail de teste enviado com sucesso!');
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao enviar e-mail de teste.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar e-mail de teste.');
    } finally {
      setTestingEmail(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
        <p>Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Notificações e E-mails</h1>
        <p className="text-sm text-slate-500 mt-1">Configure os e-mails automáticos enviados para seus clientes.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Header / Tabs */}
        <div className="border-b border-slate-100 px-2 sm:px-6 pt-4 flex gap-6">
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'status' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Status do Pedido
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`pb-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'products' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            E-mails Específicos por Produto
          </button>
          <button
            onClick={() => setActiveTab('template')}
            className={`pb-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'template' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Visual do E-mail
          </button>
        </div>

        <div className="p-6 flex-1 bg-slate-50/50">
          
          {/* TAB: STATUS EMAILS */}
          {activeTab === 'status' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-800">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Variáveis Disponíveis</p>
                  <p className="mt-1 opacity-90">Você pode usar as seguintes variáveis no assunto ou corpo do e-mail: <code className="bg-white/60 px-1 rounded">{"{{customer_name}}"}</code>, <code className="bg-white/60 px-1 rounded">{"{{order_id}}"}</code>, <code className="bg-white/60 px-1 rounded">{"{{total_amount}}"}</code>, <code className="bg-white/60 px-1 rounded">{"{{store_name}}"}</code>.</p>
                </div>
              </div>

              {(['paid', 'refunded', 'canceled'] as const).map((status) => (
                <div key={status} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={statusEmails[status].enabled}
                        onChange={(e) => setStatusEmails({
                          ...statusEmails,
                          [status]: { ...statusEmails[status], enabled: e.target.checked }
                        })}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                      />
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">
                          {status === 'paid' ? 'Pagamento Aprovado' : status === 'refunded' ? 'Pedido Reembolsado' : 'Pedido Cancelado'}
                        </h3>
                      </div>
                    </div>
                    <button
                      onClick={() => handleTestTemplate(statusEmails[status].subject, statusEmails[status].body, status)}
                      disabled={testingEmail === status}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Mail className={`w-3.5 h-3.5 ${testingEmail === status ? 'animate-pulse' : ''}`} />
                      Testar
                    </button>
                  </div>
                  
                  {statusEmails[status].enabled && (
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Assunto do E-mail</label>
                        <input
                          type="text"
                          value={statusEmails[status].subject}
                          onChange={(e) => setStatusEmails({
                            ...statusEmails,
                            [status]: { ...statusEmails[status], subject: e.target.value }
                          })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Corpo do E-mail (Texto)</label>
                        <textarea
                          rows={4}
                          value={statusEmails[status].body}
                          onChange={(e) => setStatusEmails({
                            ...statusEmails,
                            [status]: { ...statusEmails[status], body: e.target.value }
                          })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB: PRODUCT EMAILS */}
          {activeTab === 'products' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {!editingProductEmail ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-sm text-slate-600 sm:max-w-md">Configure e-mails que são disparados imediatamente após a compra de um produto específico (Ideal para entrega de links, chaves de acesso, ou materiais extras).</p>
                    <button
                      onClick={() => {
                        setIsAddingProduct(true);
                        setEditingProductEmail({ id: '', productId: '', subject: '', body: '', enabled: true });
                      }}
                      className="shrink-0 flex justify-center items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Regra
                    </button>
                  </div>

                  {productEmails.length === 0 ? (
                    <div className="text-center py-12 bg-white border border-slate-200 border-dashed rounded-xl">
                      <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <h3 className="text-sm font-bold text-slate-700">Nenhum e-mail específico configurado</h3>
                      <p className="text-xs text-slate-500 mt-1">Clique em "Adicionar Regra" para criar e-mails por produto.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {productEmails.map((pe) => {
                        const prod = products.find(p => p.id === pe.productId);
                        return (
                          <div key={pe.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm gap-4 sm:gap-2">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                                {prod?.images?.[0] ? (
                                  <img src={prod.images[0]} alt={prod.name} className="w-full h-full object-cover rounded-lg" />
                                ) : (
                                  <ShoppingBag className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-slate-800 truncate">{prod?.name || 'Produto Excluído'}</h4>
                                <p className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-sm">Assunto: {pe.subject}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-end gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pe.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {pe.enabled ? 'Ativo' : 'Inativo'}
                              </span>
                              <div className="w-px h-6 bg-slate-200 mx-1"></div>
                              <button
                                onClick={() => handleTestTemplate(pe.subject, pe.body, pe.id)}
                                disabled={testingEmail === pe.id}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Testar E-mail"
                              >
                                <Mail className={`w-4 h-4 ${testingEmail === pe.id ? 'animate-pulse text-indigo-600' : ''}`} />
                              </button>
                              <button
                                onClick={() => { setIsAddingProduct(false); setEditingProductEmail(pe); }}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setProductEmails(productEmails.filter(p => p.id !== pe.id))}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="text-sm font-bold text-slate-800">
                      {isAddingProduct ? 'Nova Regra de E-mail' : 'Editar Regra'}
                    </h3>
                    <button 
                      onClick={() => setEditingProductEmail(null)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-5">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={editingProductEmail.enabled}
                        onChange={(e) => setEditingProductEmail({ ...editingProductEmail, enabled: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                        id="enable-prod-email"
                      />
                      <label htmlFor="enable-prod-email" className="text-sm font-semibold text-slate-800 cursor-pointer">
                        Ativar envio deste e-mail
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Produto Alvo</label>
                      <select
                        value={editingProductEmail.productId}
                        onChange={(e) => setEditingProductEmail({ ...editingProductEmail, productId: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="">Selecione um produto...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Assunto do E-mail</label>
                      <input
                        type="text"
                        value={editingProductEmail.subject}
                        onChange={(e) => setEditingProductEmail({ ...editingProductEmail, subject: e.target.value })}
                        placeholder="Ex: Seu Acesso Exclusivo - {{product_name}}"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mensagem / Conteúdo (Texto)</label>
                      <textarea
                        rows={6}
                        value={editingProductEmail.body}
                        onChange={(e) => setEditingProductEmail({ ...editingProductEmail, body: e.target.value })}
                        placeholder="Olá {{customer_name}},\n\nAqui está o link de acesso ao material que você comprou..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                      />
                      <p className="text-[11px] text-slate-500 mt-1.5">Você pode usar: {"{{customer_name}}, {{order_id}}, {{product_name}}, {{store_name}}"}</p>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                      <button
                        onClick={() => handleTestTemplate(editingProductEmail.subject, editingProductEmail.body, 'editing')}
                        disabled={testingEmail === 'editing'}
                        className="px-4 py-2 bg-indigo-50 text-indigo-600 font-semibold text-sm hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-2 mr-auto"
                      >
                        <Mail className={`w-4 h-4 ${testingEmail === 'editing' ? 'animate-pulse' : ''}`} />
                        Testar E-mail
                      </button>
                      <button
                        onClick={() => setEditingProductEmail(null)}
                        className="px-4 py-2 text-slate-600 font-semibold text-sm hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={saveProductEmailForm}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                      >
                        Confirmar Regra
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        
          {activeTab === 'template' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-4">Aparência do E-mail</h3>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Logotipo do E-mail</label>
                    <div className="flex gap-2">
                      <label className="flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-lg cursor-pointer hover:bg-slate-800 transition-colors text-sm font-medium">
                        {uploadingLogo ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          'Fazer Upload'
                        )}
                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
                      </label>
                      {templateConfig.logoUrl && (
                        <button
                          onClick={() => setTemplateConfig({ ...templateConfig, logoUrl: '' })}
                          className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">Recomendado: Imagem PNG com fundo transparente.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cor Principal (Botões e Destaques)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={templateConfig.primaryColor}
                          onChange={(e) => setTemplateConfig({ ...templateConfig, primaryColor: e.target.value })}
                          className="w-10 h-10 p-0 border-0 rounded overflow-hidden cursor-pointer"
                        />
                        <input
                          type="text"
                          value={templateConfig.primaryColor}
                          onChange={(e) => setTemplateConfig({ ...templateConfig, primaryColor: e.target.value })}
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cor de Fundo do E-mail</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={templateConfig.backgroundColor}
                          onChange={(e) => setTemplateConfig({ ...templateConfig, backgroundColor: e.target.value })}
                          className="w-10 h-10 p-0 border-0 rounded overflow-hidden cursor-pointer"
                        />
                        <input
                          type="text"
                          value={templateConfig.backgroundColor}
                          onChange={(e) => setTemplateConfig({ ...templateConfig, backgroundColor: e.target.value })}
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Texto do Rodapé</label>
                    <textarea
                      rows={2}
                      value={templateConfig.footerText}
                      onChange={(e) => setTemplateConfig({ ...templateConfig, footerText: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Variáveis disponíveis: {"{{store_name}}"}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-4">Pré-visualização</h3>
                <div 
                  className="rounded-lg p-6 flex flex-col items-center justify-center min-h-[300px] border border-slate-100"
                  style={{ backgroundColor: templateConfig.backgroundColor }}
                >
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 w-full max-w-md overflow-hidden">
                    {templateConfig.logoUrl && (
                      <div className="p-6 pb-2 text-center border-b border-slate-50">
                        <img src={templateConfig.logoUrl} alt="Logo" className="max-h-12 mx-auto" />
                      </div>
                    )}
                    <div className="p-6 space-y-4">
                      <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse"></div>
                      <div className="h-4 w-full bg-slate-200 rounded animate-pulse"></div>
                      <div className="h-4 w-5/6 bg-slate-200 rounded animate-pulse"></div>
                      <div className="pt-2">
                        <div 
                          className="h-10 w-full rounded-md opacity-80"
                          style={{ backgroundColor: templateConfig.primaryColor }}
                        ></div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-100">
                      {templateConfig.footerText.replace(/\{\{store_name\}\}/g, activeStore?.name || 'Sua Loja')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Global Save Action */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          {success ? (
             <div className="flex items-center text-emerald-600 text-sm font-medium gap-1.5 animate-in fade-in slide-in-from-bottom-2">
               <CheckCircle2 className="w-5 h-5" /> Preferências salvas com sucesso!
             </div>
          ) : <div className="hidden sm:block" />}
          <button
            onClick={handleSaveAll}
            disabled={saving || !!editingProductEmail}
            className="w-full sm:w-auto justify-center px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Gravando...</>
            ) : (
              <><Save className="w-4 h-4" /> Salvar Configurações</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
