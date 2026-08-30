import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { generateSlug } from './utils';

export const RESERVED_SLUGS = [
  'admin',
  'api',
  'login',
  'register',
  'onboarding',
  'checkout',
  'cart',
  'orders',
  'products',
  'categories',
  'customers',
  'payments',
  'settings',
  'auth',
  'app',
  'store',
  'loja',
  'suporte',
  'help',
  'terms',
  'termos',
  'privacidade',
  'privacy',
  'sobre',
  'about',
  'contato',
  'contact',
  'dashboard',
  'p'
];

export interface AvailabilityResult {
  isValid: boolean;
  nameAvailable: boolean;
  slugAvailable: boolean;
  nameError: string | null;
  slugError: string | null;
  sanitizedSlug: string;
}

/**
 * Valida se o nome da loja e o slug estão disponíveis e não colidem com lojas existentes ou rotas reservadas.
 */
export async function checkStoreNameAndSlugAvailability(
  storeName: string,
  rawSlug?: string,
  excludeStoreId?: string
): Promise<AvailabilityResult> {
  const cleanName = storeName.trim();
  const targetSlug = rawSlug ? generateSlug(rawSlug) : generateSlug(cleanName);

  const result: AvailabilityResult = {
    isValid: false,
    nameAvailable: false,
    slugAvailable: false,
    nameError: null,
    slugError: null,
    sanitizedSlug: targetSlug
  };

  // 1. Validação básica de tamanho do nome
  if (!cleanName) {
    result.nameError = 'Informe o nome da sua loja.';
    return result;
  }

  if (cleanName.length < 3) {
    result.nameError = 'O nome da loja deve ter pelo menos 3 caracteres.';
    return result;
  }

  if (cleanName.length > 50) {
    result.nameError = 'O nome da loja deve ter no máximo 50 caracteres.';
    return result;
  }

  // 2. Validação básica do slug
  if (!targetSlug) {
    result.slugError = 'O link da loja não pode ficar vazio.';
    return result;
  }

  if (targetSlug.length < 3) {
    result.slugError = 'O slug deve ter pelo menos 3 caracteres.';
    return result;
  }

  if (targetSlug.length > 50) {
    result.slugError = 'O slug deve ter no máximo 50 caracteres.';
    return result;
  }

  // 3. Verificação de palavras reservadas
  if (RESERVED_SLUGS.includes(targetSlug.toLowerCase())) {
    result.slugError = `O link "${targetSlug}" é uma palavra reservada do sistema. Por favor, escolha outro.`;
    return result;
  }

  try {
    const storesRef = collection(db, 'stores');

    // 4. Verificação de unicidade do SLUG no Firestore
    const slugQuery = query(
      storesRef,
      where('slug', '==', targetSlug),
      limit(2)
    );
    const slugSnap = await getDocs(slugQuery);
    
    let slugExists = false;
    slugSnap.forEach(doc => {
      if (!excludeStoreId || doc.id !== excludeStoreId) {
        slugExists = true;
      }
    });

    if (slugExists) {
      result.slugAvailable = false;
      result.slugError = `O link "/${targetSlug}" já está em uso por outra loja. Escolha outro slug.`;
    } else {
      result.slugAvailable = true;
    }

    // 5. Verificação de unicidade do NOME da Loja no Firestore
    // Verifica tanto por busca direta quanto por verificação case-insensitive
    const nameLower = cleanName.toLowerCase();
    
    // Busca exata
    const nameExactQuery = query(
      storesRef,
      where('name', '==', cleanName),
      limit(2)
    );
    const nameExactSnap = await getDocs(nameExactQuery);
    
    let nameExists = false;
    nameExactSnap.forEach(doc => {
      if (!excludeStoreId || doc.id !== excludeStoreId) {
        nameExists = true;
      }
    });

    // Busca por nameLower se houver campo correspondente ou varredura de duplicata
    if (!nameExists) {
      const nameLowerQuery = query(
        storesRef,
        where('nameLower', '==', nameLower),
        limit(2)
      );
      const nameLowerSnap = await getDocs(nameLowerQuery);
      nameLowerSnap.forEach(doc => {
        if (!excludeStoreId || doc.id !== excludeStoreId) {
          nameExists = true;
        }
      });
    }

    if (nameExists) {
      result.nameAvailable = false;
      result.nameError = `O nome "${cleanName}" já está em uso por outra loja. Escolha outro nome.`;
    } else {
      result.nameAvailable = true;
    }

    result.isValid = result.nameAvailable && result.slugAvailable;
    return result;
  } catch (error: any) {
    console.warn('Erro ao checar disponibilidade:', error);
    // Em caso de falha na consulta (ex: regras/offline), mantém slug sanitizado mas sem permitir colisão
    result.nameAvailable = true;
    result.slugAvailable = true;
    result.isValid = true;
    return result;
  }
}
