import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { doc, getDoc, collection, addDoc, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { Category } from '../../types';
import { FastCache } from '../../lib/cache';
import { generateSlug } from '../../lib/utils';
import { safeWrite } from '../../lib/asyncGuard';
import { ArrowLeft, Upload, X } from 'lucide-react';
import { Link } from 'react-router';

export function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeStore } = useAuthStore();
  const isEditing = Boolean(id);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stock, setStock] = useState('0');
  const [active, setActive] = useState(true);
  const [isDigital, setIsDigital] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  
  // Weight & Dimensions
  const [weight, setWeight] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!activeStore) return;
      try {
        // Load categories
        const catSnap = await getDocs(collection(db, 'stores', activeStore.id, 'categories'));
        const cats: Category[] = [];
        catSnap.forEach(d => cats.push({ id: d.id, ...d.data() } as Category));
        setCategories(cats);

        if (isEditing && id) {
          const productSnap = await getDoc(doc(db, 'stores', activeStore.id, 'products', id));
          if (productSnap.exists()) {
            const data = productSnap.data();
            setName(data.name);
            setDescription(data.description);
            setPrice(data.price.toString());
            setSku(data.sku || '');
            setCategoryId(data.categoryId || '');
            setStock(data.stock?.toString() || '0');
            setActive(data.active !== false);
            setIsDigital(data.isDigital === true);
            setImages(data.images || []);
            setWeight(data.weight?.toString() || '');
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeStore, id, isEditing]);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !activeStore) return;
    const file = e.target.files[0];
    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `stores/${activeStore.id}/products/${Date.now()}_${file.name}`);
      const uploadTask = await uploadBytesResumable(storageRef, file);
      const downloadURL = await getDownloadURL(uploadTask.ref);
      setImages(prev => [...prev, downloadURL]);
    } catch (err) {
      console.error(err);
      alert('Erro ao fazer upload da imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;
    setSubmitting(true);

    try {
      const productData = {
        name,
        slug: generateSlug(name),
        description,
        price: parseFloat(price) || 0,
        sku,
        categoryId: categoryId || 'todos',
        stock: parseInt(stock, 10) || 0,
        active,
        isDigital,
        images,
        weight: parseFloat(weight) || 0,
        updatedAt: serverTimestamp()
      };

      // Inicia a gravação no Firestore, mas não bloqueia a interface (Atualização Otimista)
      const savePromise = isEditing && id
        ? updateDoc(doc(db, 'stores', activeStore.id, 'products', id), productData)
        : addDoc(collection(db, 'stores', activeStore.id, 'products'), {
            ...productData,
            createdAt: serverTimestamp()
          });

      // Usa safeWrite para não travar a interface se houver lentidão na rede,
      // mas lança erro imediato se houver problema de permissão
      await safeWrite(savePromise, 2000);
      
      // Invalida o cache para garantir que a vitrine e painel busquem dados frescos
      FastCache.invalidate(`products_${activeStore.id}`);
      FastCache.invalidate(`admin_products_${activeStore.id}`);

      navigate('/admin/products');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar produto. Verifique sua conexão.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Carregando formulário...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex items-center mb-6">
        <Link to="/admin/products" className="text-gray-500 hover:text-gray-900 mr-4">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Editar Produto' : 'Novo Produto'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Informações Básicas</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome do Produto</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Descrição</label>
              <textarea
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Preço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Categoria</label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Selecione...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Mídia</h2>
          <div className="flex flex-wrap gap-4 mb-4">
            {images.map((url, i) => (
              <div key={i} className="relative h-24 w-24 border rounded-md overflow-hidden bg-gray-50">
                <img src={url} alt="" className="object-cover w-full h-full" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            
            <label className="h-24 w-24 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50">
              {uploadingImage ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-gray-400" />
                  <span className="text-xs text-gray-500 mt-1">Upload</span>
                </>
              )}
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
            </label>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Estoque e Configurações</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">SKU (Código)</label>
              <input
                type="text"
                value={sku}
                onChange={e => setSku(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            {!isDigital && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantidade em Estoque</label>
                <input
                  type="number"
                  value={stock}
                  onChange={e => setStock(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between py-3 border-t border-gray-100 mt-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Produto Digital</p>
              <p className="text-sm text-gray-500">Este produto não requer frete físico</p>
            </div>
            <button
              type="button"
              onClick={() => setIsDigital(!isDigital)}
              className={`${isDigital ? 'bg-indigo-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
            >
              <span aria-hidden="true" className={`${isDigital ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
            </button>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Produto Ativo</p>
              <p className="text-sm text-gray-500">Ocultar ou mostrar este produto na loja</p>
            </div>
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`${active ? 'bg-indigo-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
            >
              <span aria-hidden="true" className={`${active ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : 'Salvar Produto'}
          </button>
        </div>
      </form>
    </div>
  );
}
