import crypto from 'crypto';
import express from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { constantTimeCompare } from './server-webhook-service';

/**
 * Funções Criptográficas de Alta Segurança para Senhas (OWASP / scrypt)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024
  });
  return `scrypt:${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedRecord: string): boolean {
  if (!password || !storedRecord) return false;

  // Formato Seguro Moderno: scrypt:<salt_hex>:<hash_hex>
  if (storedRecord.startsWith('scrypt:')) {
    const parts = storedRecord.split(':');
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1], 'hex');
    const expectedHash = parts[2];
    const computedKey = crypto.scryptSync(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 32 * 1024 * 1024
    }).toString('hex');
    return constantTimeCompare(computedKey, expectedHash);
  }

  // Compatibilidade com senhas legadas (Plaintext) -> para auto-migração
  return constantTimeCompare(password, storedRecord);
}

/**
 * Remove qualquer credencial ou campo sensível antes de retornar ao frontend
 */
export function sanitizeCustomer(docData: any): any {
  if (!docData) return null;
  const {
    password,
    passwordHash,
    failedLoginAttempts,
    lockoutUntil,
    serverCreatedAt,
    ...safeCustomer
  } = docData;
  return safeCustomer;
}

// Memória de Rate Limit anti-bruteforce (IP + store + username)
interface AttemptTracker {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}
const authAttempts = new Map<string, AttemptTracker>();

function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const tracker = authAttempts.get(key);

  if (!tracker) {
    return { allowed: true };
  }

  if (tracker.blockedUntil && tracker.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((tracker.blockedUntil - now) / 1000)
    };
  }

  if (now - tracker.firstAttemptAt > 15 * 60 * 1000) {
    authAttempts.delete(key);
    return { allowed: true };
  }

  if (tracker.count >= 5) {
    tracker.blockedUntil = now + 15 * 60 * 1000;
    return { allowed: false, retryAfterSeconds: 15 * 60 };
  }

  return { allowed: true };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const tracker = authAttempts.get(key) || { count: 0, firstAttemptAt: now };
  tracker.count++;
  if (tracker.count >= 5) {
    tracker.blockedUntil = now + 15 * 60 * 1000;
  }
  authAttempts.set(key, tracker);
}

function clearAttempts(key: string) {
  authAttempts.delete(key);
}

export function setupCustomerAuthRoutes(app: express.Express, getDb: any) {
  /**
   * POST /api/stores/:storeId/customers/register
   * Cadastro de cliente de loja com hash seguro scrypt e sanitização de saída
   */
  app.post('/api/stores/:storeId/customers/register', async (req: express.Request, res: express.Response) => {
    try {
      const { storeId } = req.params;
      const { username, password, name, cpf, phone, email, address } = req.body;

      if (!storeId) {
        return res.status(400).json({ success: false, error: 'Identificador da loja inválido.' });
      }

      if (!username || typeof username !== 'string' || username.trim().length < 3) {
        return res.status(400).json({ success: false, error: 'O nome de usuário deve conter no mínimo 3 caracteres.' });
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ success: false, error: 'A senha deve conter no mínimo 6 caracteres.' });
      }

      if (!name || !cpf || !phone) {
        return res.status(400).json({ success: false, error: 'Nome completo, CPF e Telefone são obrigatórios.' });
      }

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
      const rateLimitKey = `reg_${clientIp}_${storeId}`;
      const rateCheck = checkRateLimit(rateLimitKey);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: `Muitas tentativas de cadastro. Tente novamente em ${rateCheck.retryAfterSeconds} segundos.`
        });
      }

      const db = getDb();
      const cleanUsername = username.trim().toLowerCase();

      // Verifica se a loja existe
      const storeDoc = await db.collection('stores').doc(storeId).get();
      if (!storeDoc.exists) {
        return res.status(404).json({ success: false, error: 'Loja não encontrada.' });
      }

      // Verifica unicidade de username na loja
      const existingSnap = await db.collection('stores').doc(storeId).collection('customers')
        .where('usernameLower', '==', cleanUsername)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        return res.status(400).json({ success: false, error: 'Este nome de usuário já está cadastrado nesta loja.' });
      }

      const customerId = `cust_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const securePasswordHash = hashPassword(password);

      const customerDocData = {
        id: customerId,
        storeId,
        username: username.trim(),
        usernameLower: cleanUsername,
        passwordHash: securePasswordHash, // Hash seguro scrypt
        name: name.trim(),
        email: email?.trim() || '',
        cpf: cpf.trim(),
        phone: phone.trim(),
        address: address || {
          zipcode: '',
          street: '',
          number: '',
          complement: '',
          neighborhood: '',
          city: '',
          state: ''
        },
        totalOrders: 0,
        totalSpent: 0,
        createdAt: new Date().toISOString(),
        serverCreatedAt: FieldValue.serverTimestamp()
      };

      await db.collection('stores').doc(storeId).collection('customers').doc(customerId).set(customerDocData);

      const safeCustomer = sanitizeCustomer(customerDocData);
      return res.status(201).json({ success: true, customer: safeCustomer });
    } catch (err: any) {
      console.error('[Customer Auth Register] Erro:', err.message);
      return res.status(500).json({ success: false, error: 'Erro interno ao registrar cliente.' });
    }
  });

  /**
   * POST /api/stores/:storeId/customers/login
   * Login de cliente com hash scrypt, migração automática de legado e anti-bruteforce
   */
  app.post('/api/stores/:storeId/customers/login', async (req: express.Request, res: express.Response) => {
    try {
      const { storeId } = req.params;
      const { username, password } = req.body;

      if (!storeId || !username || !password) {
        return res.status(400).json({ success: false, error: 'Usuário e senha são obrigatórios.' });
      }

      const cleanUsername = String(username).trim().toLowerCase();
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
      const rateLimitKey = `auth_${clientIp}_${storeId}_${cleanUsername}`;

      const rateCheck = checkRateLimit(rateLimitKey);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: `Muitas tentativas falhas. Bloqueado temporariamente por ${rateCheck.retryAfterSeconds} segundos.`
        });
      }

      const db = getDb();
      const customersRef = db.collection('stores').doc(storeId).collection('customers');
      const snap = await customersRef.where('usernameLower', '==', cleanUsername).limit(1).get();

      if (snap.empty) {
        recordFailedAttempt(rateLimitKey);
        return res.status(401).json({ success: false, error: 'Usuário ou senha incorretos para esta loja.' });
      }

      const customerDoc = snap.docs[0];
      const customerData = customerDoc.data();

      const storedHash = customerData.passwordHash;
      const legacyPassword = customerData.password;
      const authSecretToVerify = storedHash || legacyPassword;

      if (!authSecretToVerify) {
        recordFailedAttempt(rateLimitKey);
        return res.status(401).json({ success: false, error: 'Usuário ou senha incorretos para esta loja.' });
      }

      const isPasswordValid = verifyPassword(String(password), authSecretToVerify);

      if (!isPasswordValid) {
        recordFailedAttempt(rateLimitKey);
        return res.status(401).json({ success: false, error: 'Usuário ou senha incorretos para esta loja.' });
      }

      // Sucesso no login: limpa tentativas falhas
      clearAttempts(rateLimitKey);

      // Migração automática de senha legada plaintext -> scrypt hash com deleção do campo antigo
      if (legacyPassword && !storedHash) {
        try {
          const migratedHash = hashPassword(String(password));
          await customerDoc.ref.update({
            passwordHash: migratedHash,
            password: FieldValue.delete(),
            migratedAt: FieldValue.serverTimestamp()
          });
          console.log(`[Customer Auth] Cliente ${customerDoc.id} migrado com sucesso para scrypt hash.`);
        } catch (migErr: any) {
          console.error('[Customer Auth] Falha na migração de senha legada:', migErr.message);
        }
      }

      const safeCustomer = sanitizeCustomer({ id: customerDoc.id, ...customerData });
      return res.status(200).json({ success: true, customer: safeCustomer });
    } catch (err: any) {
      console.error('[Customer Auth Login] Erro:', err.message);
      return res.status(500).json({ success: false, error: 'Erro interno ao realizar autenticação.' });
    }
  });

  /**
   * GET /api/stores/:storeId/customers/check-username
   * Verificação de disponibilidade de nome de usuário
   */
  app.get('/api/stores/:storeId/customers/check-username', async (req: express.Request, res: express.Response) => {
    try {
      const { storeId } = req.params;
      const username = req.query.username as string;

      if (!storeId || !username || !username.trim()) {
        return res.status(400).json({ available: false });
      }

      const cleanUsername = username.trim().toLowerCase();
      const db = getDb();
      const snap = await db.collection('stores').doc(storeId).collection('customers')
        .where('usernameLower', '==', cleanUsername)
        .limit(1)
        .get();

      return res.json({ available: snap.empty });
    } catch (err: any) {
      console.error('[Customer Auth Check] Erro:', err.message);
      return res.json({ available: true });
    }
  });
}
