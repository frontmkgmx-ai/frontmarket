import React, { useState, useEffect, FormEvent } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { Category } from '../../types';
import { generateSlug } from '../../lib/utils';
import { Edit2, Trash2, Plus, X, Sparkles, Folder } from 'lucide-react';
import { FastCache } from '../../lib/cache';
import { safeWrite } from '../../lib/asyncGuard';

export function Categories() {
  const { activeStore } = useAuthStore();
  const cacheKey = activeStore?.id ? `categories_${activeStore.id}` : '';
  
  const [categories, setCategories] = useState<Category[]>(() => {
    return (cacheKey && FastCache.get(cacheKey)) || [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return cacheKey ? !FastCache.get(cacheKey) : true;
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeStore?.id) {
      setLoading(false);
      return;
    }

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const q = query(
      collection(db, 'stores', activeStore.id, 'categories'),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      clearTimeout(safetyTimer);
      const cats: Category[] = [];
      snapshot.forEach(d => cats.push({ id: d.id, ...d.data() } as Category));
      setCategories(cats);
      if (cacheKey) FastCache.set(cacheKey, cats);
      setLoading(false);
    }, (err) => {
      clearTimeout(safetyTimer);
      console.warn("Categories listener warning:", err);
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [activeStore?.id, cacheKey]);

  const openNew = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!activeStore || !window.confirm('Tem certeza que deseja excluir esta categoria?')) return;
    try {
      await safeWrite(deleteDoc(doc(db, 'stores', activeStore.id, 'categories', id)));
      if (cacheKey) FastCache.invalidate(cacheKey);
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir categoria');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeStore || submitting || !name.trim()) return;
    
    setSubmitting(true);
    try {
      const categoryData = {
        name: name.trim(),
        slug: generateSlug(name.trim()),
        description: description.trim(),
        active: true,
        order: 0,
        updatedAt: serverTimestamp()
      };

      const savePromise = editingCategory 
        ? updateDoc(doc(db, 'stores', activeStore.id, 'categories', editingCategory.id), categoryData)
        : addDoc(collection(db, 'stores', activeStore.id, 'categories'), {
            ...categoryData,
            createdAt: serverTimestamp()
          });

      await safeWrite(savePromise);
      
      if (cacheKey) FastCache.invalidate(cacheKey);
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar categoria');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Categorias</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="w-3 h-3 mr-1" /> Tempo Real
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Organize os departamentos e grupos de produtos da sua loja</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nova Categoria
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="p-6 sm:p-8">
            <div className="animate-pulse flex flex-col space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 border-b border-slate-100 pb-4">
                  <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                  <div className="flex-1"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                  <div className="h-6 bg-slate-200 rounded w-16"></div>
                </div>
              ))}
            </div>
          </div>
        ) : categories.length === 0 ? (
          <div className="p-10 sm:p-14 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Folder className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Nenhuma categoria encontrada</h3>
            <p className="text-slate-500 text-xs mb-5 max-w-xs mx-auto">Crie categorias como "Roupas", "Acessórios" ou "E-books" para organizar seus produtos.</p>
            <button
              onClick={openNew}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Criar Primeira Categoria
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Nome
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Slug (URL)
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {categories.map((category) => (
                  <tr key={category.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs sm:text-sm font-semibold text-slate-900">
                      {category.name}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500 font-mono">
                      /{category.slug}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right text-xs font-semibold">
                      <button
                        onClick={() => openEdit(category)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3 inline-flex items-center cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
                        className="text-rose-500 hover:text-rose-700 inline-flex items-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={() => setIsModalOpen(false)} />
            
            <div className="inline-block align-middle bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-lg w-full z-10 border border-slate-100">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-6 pt-6 pb-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-900">
                      {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                    </h3>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1">Nome da Categoria</label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Camisetas, Eletrônicos, Cursos"
                        className="block w-full border border-slate-300 rounded-xl shadow-2xs py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="description" className="block text-xs font-semibold text-slate-700 mb-1">Descrição (opcional)</label>
                      <textarea
                        id="description"
                        name="description"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Breve descrição dos itens desta categoria"
                        className="block w-full border border-slate-300 rounded-xl shadow-2xs py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 px-6 py-3.5 sm:flex sm:flex-row-reverse gap-2 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={submitting || !name.trim()}
                    className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-xs px-4 py-2 bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 sm:w-auto disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {submitting ? 'Salvando...' : 'Salvar Categoria'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="mt-2 sm:mt-0 w-full inline-flex justify-center rounded-xl border border-slate-300 px-4 py-2 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 sm:w-auto transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
