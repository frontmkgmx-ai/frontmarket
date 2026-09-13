import type { Express, Request, Response } from 'express';
import { getAdminDb } from './server-firebase-admin.js';

export function setupPublicStoreRoutes(app: Express) {
  // 1. Obter dados públicos de uma loja (por slug, ID ou domínio personalizado)
  app.get('/api/public/stores/:storeSlugOrId', async (req: Request, res: Response) => {
    try {
      const { storeSlugOrId } = req.params;
      if (!storeSlugOrId) {
        return res.status(400).json({ error: 'Parâmetro de identificação da loja obrigatório' });
      }

      const db = getAdminDb();
      const cleanParam = decodeURIComponent(storeSlugOrId).trim();
      const lowerParam = cleanParam.toLowerCase();

      let storeDoc: any = null;

      // Tentativa A: busca por slug exato
      const slugSnap = await db.collection('stores').where('slug', '==', cleanParam).limit(1).get();
      if (!slugSnap.empty) {
        storeDoc = slugSnap.docs[0];
      }

      // Tentativa B: busca por slug em minúsculas
      if (!storeDoc && cleanParam !== lowerParam) {
        const lowerSlugSnap = await db.collection('stores').where('slug', '==', lowerParam).limit(1).get();
        if (!lowerSlugSnap.empty) {
          storeDoc = lowerSlugSnap.docs[0];
        }
      }

      // Tentativa C: busca direta por Document ID
      if (!storeDoc) {
        const idSnap = await db.collection('stores').doc(cleanParam).get();
        if (idSnap.exists) {
          storeDoc = idSnap;
        }
      }

      // Tentativa D: busca por domínio personalizado (customDomains)
      if (!storeDoc) {
        const domainSnap = await db.collection('stores').where('customDomains', 'array-contains', lowerParam).limit(1).get();
        if (!domainSnap.empty) {
          storeDoc = domainSnap.docs[0];
        }
      }

      // Tentativa E: varredura em memória de segurança (se slugs tiverem variações)
      if (!storeDoc) {
        const allStores = await db.collection('stores').limit(20).get();
        storeDoc = allStores.docs.find(doc => {
          const d = doc.data();
          return (
            d.slug === cleanParam ||
            d.slug?.toLowerCase() === lowerParam ||
            doc.id === cleanParam ||
            (Array.isArray(d.customDomains) && d.customDomains.some((cd: string) => cd.toLowerCase() === lowerParam))
          );
        }) || null;
      }

      if (!storeDoc) {
        return res.status(404).json({ error: 'Loja não encontrada' });
      }

      const data = storeDoc.data();
      const sanitizedStore = {
        id: storeDoc.id,
        name: data.name || cleanParam,
        slug: data.slug || cleanParam,
        ownerId: data.ownerId,
        createdAt: data.createdAt,
        customDomains: data.customDomains || [],
        settings: data.settings || {
          currency: 'BRL',
          themeColor: '#007AFF',
          contactEmail: '',
          supportPhone: ''
        }
      };

      res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      return res.json({ store: sanitizedStore });
    } catch (err: any) {
      console.error('[API Public Store] Erro ao buscar loja:', err);
      return res.status(500).json({ error: 'Erro interno ao consultar loja', message: err.message });
    }
  });

  // 2. Obter lista de produtos e categorias ativos de uma loja
  app.get('/api/public/stores/:storeSlugOrId/products', async (req: Request, res: Response) => {
    try {
      const { storeSlugOrId } = req.params;
      const db = getAdminDb();
      const cleanParam = decodeURIComponent(storeSlugOrId).trim();

      // Resolve a loja primeiro
      let storeId = cleanParam;
      let storeRef = db.collection('stores').doc(cleanParam);
      let storeSnap = await storeRef.get();

      if (!storeSnap.exists) {
        const qStore = await db.collection('stores').where('slug', '==', cleanParam).limit(1).get();
        if (!qStore.empty) {
          storeId = qStore.docs[0].id;
          storeRef = qStore.docs[0].ref;
          storeSnap = qStore.docs[0];
        } else {
          // Busca case-insensitive
          const qAll = await db.collection('stores').limit(20).get();
          const match = qAll.docs.find(d => d.data().slug?.toLowerCase() === cleanParam.toLowerCase() || d.id === cleanParam);
          if (match) {
            storeId = match.id;
            storeRef = match.ref;
            storeSnap = match;
          } else {
            return res.status(404).json({ error: 'Loja não encontrada' });
          }
        }
      }

      // Busca produtos e categorias em paralelo
      const [productsSnap, categoriesSnap] = await Promise.all([
        storeRef.collection('products').where('active', '==', true).get(),
        storeRef.collection('categories').where('active', '==', true).get()
      ]);

      const products = productsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const categories = categoriesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
      return res.json({ storeId, products, categories });
    } catch (err: any) {
      console.error('[API Public Products] Erro ao buscar produtos:', err);
      return res.status(500).json({ error: 'Erro ao consultar catálogo', message: err.message });
    }
  });

  // 3. Obter detalhes de UM produto específico (por slug ou ID) com resolução ultra-resiliente
  app.get('/api/public/stores/:storeSlugOrId/products/:productSlug', async (req: Request, res: Response) => {
    try {
      const { storeSlugOrId, productSlug } = req.params;
      if (!storeSlugOrId || !productSlug) {
        return res.status(400).json({ error: 'Identificadores de loja e produto são obrigatórios' });
      }

      const db = getAdminDb();
      const cleanStoreParam = decodeURIComponent(storeSlugOrId).trim();
      const cleanProductSlug = decodeURIComponent(productSlug).trim();
      const lowerProductSlug = cleanProductSlug.toLowerCase();

      // 1. Resolve a loja
      let storeRef: any = null;
      let storeData: any = null;

      const storeById = await db.collection('stores').doc(cleanStoreParam).get();
      if (storeById.exists) {
        storeRef = storeById.ref;
        storeData = storeById.data();
      } else {
        const storeBySlug = await db.collection('stores').where('slug', '==', cleanStoreParam).limit(1).get();
        if (!storeBySlug.empty) {
          storeRef = storeBySlug.docs[0].ref;
          storeData = storeBySlug.docs[0].data();
        } else {
          // Case-insensitive store match
          const allStores = await db.collection('stores').limit(30).get();
          const matchStore = allStores.docs.find(d => 
            d.data().slug?.toLowerCase() === cleanStoreParam.toLowerCase() ||
            d.id === cleanStoreParam
          );
          if (matchStore) {
            storeRef = matchStore.ref;
            storeData = matchStore.data();
          }
        }
      }

      if (!storeRef) {
        return res.status(404).json({ error: 'Loja não encontrada' });
      }

      // 2. Busca o produto com múltiplas estratégias
      let productDoc: any = null;

      // Estratégia A: Busca direta por slug
      const pBySlug = await storeRef.collection('products').where('slug', '==', cleanProductSlug).limit(1).get();
      if (!pBySlug.empty) {
        productDoc = pBySlug.docs[0];
      }

      // Estratégia B: Se não achou, tenta por slug em minúsculas
      if (!productDoc && cleanProductSlug !== lowerProductSlug) {
        const pByLowerSlug = await storeRef.collection('products').where('slug', '==', lowerProductSlug).limit(1).get();
        if (!pByLowerSlug.empty) {
          productDoc = pByLowerSlug.docs[0];
        }
      }

      // Estratégia C: Busca direta por ID do documento
      if (!productDoc) {
        const pById = await storeRef.collection('products').doc(cleanProductSlug).get();
        if (pById.exists) {
          productDoc = pById;
        }
      }

      // Estratégia D: Fallback completo - obtém todos os produtos da loja e encontra por slug normalizado ou ID
      if (!productDoc) {
        const allProds = await storeRef.collection('products').get();
        productDoc = allProds.docs.find((p: any) => {
          const d = p.data();
          const itemSlug = (d.slug || '').trim().toLowerCase();
          const targetSlug = lowerProductSlug;
          return (
            p.id === cleanProductSlug ||
            itemSlug === targetSlug ||
            itemSlug.replace(/[^a-z0-9]/g, '') === targetSlug.replace(/[^a-z0-9]/g, '')
          );
        }) || null;
      }

      if (!productDoc) {
        console.warn(`[API Public Store] Produto não encontrado: store=${cleanStoreParam}, slug=${cleanProductSlug}`);
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      const product = {
        id: productDoc.id,
        ...productDoc.data()
      };

      res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      return res.json({ 
        product,
        store: {
          id: storeRef.id,
          name: storeData?.name || cleanStoreParam,
          slug: storeData?.slug || cleanStoreParam
        }
      });
    } catch (err: any) {
      console.error('[API Public Product Detail] Erro ao buscar produto:', err);
      return res.status(500).json({ error: 'Erro interno ao consultar produto', message: err.message });
    }
  });
}
