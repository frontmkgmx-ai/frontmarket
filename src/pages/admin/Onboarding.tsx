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
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="max-w-md w-full space-y-8 bg-white/10 backdrop-blur-xl p-8 rounded-2xl border border-white/20 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-white/20 rounded-full flex items-center justify-center border border-white/30 backdrop-blur-md">
            <Store className="h-6 w-6 text-teal-300" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Crie sua loja
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            Qual será o nome do seu novo negócio?
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
              <label className="block text-sm font-medium text-gray-300" htmlFor="storeName">
                Nome da Loja
              </label>
              <input
                id="storeName"
                name="storeName"
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 bg-white/5 border border-white/20 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm mt-1 backdrop-blur-sm"
                placeholder="Minha Loja Inc"
              />
              {storeName && (
                <p className="mt-2 text-xs text-teal-300 font-medium">
                  Sua loja ficará disponível em: <span className="underline">frontmk.com.br/loja/{generateSlug(storeName)}</span>
                </p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !storeName.trim()}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-indigo-950 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
              {loading ? 'Criando...' : 'Avançar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
