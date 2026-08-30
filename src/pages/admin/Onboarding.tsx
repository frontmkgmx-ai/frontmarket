import { useState } from 'react';
import { useNavigate } from 'react-router';
import { doc, setDoc, collection, serverTimestamp, updateDoc, arrayUnion, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { generateSlug } from '../../lib/utils';
import { Store } from 'lucide-react';

export function Onboarding() {
  const [storeName, setStoreName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, reloadProfile } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim() || !user) return;
    
    setError('');
    setLoading(true);

    try {
      const slug = generateSlug(storeName);
      
      // Validação de exclusividade do slug da loja
      const slugQuery = query(collection(db, 'stores'), where('slug', '==', slug));
      const slugSnapshot = await getDocs(slugQuery);
      
      if (!slugSnapshot.empty) {
        setError('Este nome de loja já está em uso. Por favor, escolha outro.');
        setLoading(false);
        return;
      }
      
      const storeRef = doc(collection(db, 'stores'));
      const storeData = {
        name: storeName,
        slug,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        settings: {
          currency: 'BRL',
          themeColor: '#4f46e5'
        }
      };

      await setDoc(storeRef, storeData);

      // Update user profile
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        stores: arrayUnion(storeRef.id)
      });

      // Also create owner member in stores/{storeId}/members
      const memberRef = doc(db, 'stores', storeRef.id, 'members', user.uid);
      await setDoc(memberRef, {
        userId: user.uid,
        role: 'owner',
        joinedAt: serverTimestamp()
      });

      // Reload profile to get the new store set as activeStore
      await reloadProfile();
      
      navigate('/admin');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao criar a loja. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <Store className="h-8 w-8 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Crie sua loja
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Qual será o nome do seu novo negócio?
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="storeName">
                Nome da Loja
              </label>
              <input
                id="storeName"
                name="storeName"
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm mt-1"
                placeholder="Minha Loja Inc"
              />
              {storeName && (
                <p className="mt-2 text-xs text-gray-500">
                  Sua loja ficará disponível em: <span className="font-medium text-indigo-600">frontmk.com.br/loja/{generateSlug(storeName)}</span>
                </p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !storeName.trim()}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Criando...' : 'Avançar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
