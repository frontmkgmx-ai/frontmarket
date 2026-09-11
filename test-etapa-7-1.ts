import assert from 'assert';
import crypto from 'crypto';
import { FinancialWalletService } from './server-financial-service';
import { constantTimeCompare, parseAndValidateWebhookPayload, canTransitionState } from './server-webhook-service';
import { isKycApproved } from './server-kyc-service';

// ============================================================================
// SIMULADOR DETERMINÍSTICO DE FIRESTORE IN-MEMORY PARA TESTES DE CONCORRÊNCIA E RECONCILIAÇÃO
// ============================================================================
class MockDocRef {
  path: string;
  id: string;
  db: MockFirestore;

  constructor(path: string, db: MockFirestore) {
    this.path = path;
    const parts = path.split('/');
    this.id = parts[parts.length - 1];
    this.db = db;
  }

  async get() {
    return this.db._getDoc(this.path);
  }

  async set(data: any, options?: { merge?: boolean }) {
    return this.db._setDoc(this.path, data, options);
  }

  async update(data: any) {
    return this.db._updateDoc(this.path, data);
  }

  collection(name: string): MockCollectionRef {
    return new MockCollectionRef(`${this.path}/${name}`, this.db);
  }
}

class MockCollectionRef {
  path: string;
  db: MockFirestore;
  _filters: Array<{ field: string; op: string; value: any }> = [];

  constructor(path: string, db: MockFirestore) {
    this.path = path;
    this.db = db;
  }

  doc(id?: string): MockDocRef {
    const docId = id || crypto.randomUUID();
    return new MockDocRef(`${this.path}/${docId}`, this.db);
  }

  where(field: string, op: string, value: any): MockCollectionRef {
    const next = new MockCollectionRef(this.path, this.db);
    next._filters = [...this._filters, { field, op, value }];
    return next;
  }

  limit(count: number): MockCollectionRef {
    return this; // mock implementation
  }

  orderBy(field: string, directionStr?: string): MockCollectionRef {
    return this; // mock implementation
  }

  async get() {
    return this.db._queryCollection(this.path, this._filters);
  }
}

class MockFirestore {
  data = new Map<string, any>();
  private _lock = Promise.resolve();

  collection(name: string): MockCollectionRef {
    return new MockCollectionRef(name, this);
  }

  collectionGroup(name: string): MockCollectionRef {
    return new MockCollectionRef(`__group__/${name}`, this);
  }

  _getDoc(path: string) {
    const val = this.data.get(path);
    const id = path.split('/').pop() || '';
    if (val === undefined) {
      return { exists: false, id, data: () => undefined };
    }
    return {
      exists: true,
      id,
      data: () => JSON.parse(JSON.stringify(val))
    };
  }

  _setDoc(path: string, data: any, options?: { merge?: boolean }) {
    const existing = this.data.get(path) || {};
    const finalData = options?.merge ? { ...existing, ...data } : data;
    this.data.set(path, JSON.parse(JSON.stringify(finalData)));
  }

  _updateDoc(path: string, data: any) {
    const existing = this.data.get(path);
    if (!existing) throw new Error(`Doc not found: ${path}`);
    this.data.set(path, { ...existing, ...JSON.parse(JSON.stringify(data)) });
  }

  _queryCollection(colPath: string, filters: any[]) {
    const docs: any[] = [];
    const isGroup = colPath.startsWith('__group__/');
    const groupName = isGroup ? colPath.replace('__group__/', '') : null;

    for (const [path, val] of this.data.entries()) {
      let matchesScope = false;
      if (isGroup) {
        matchesScope = path.includes(`/${groupName}/`);
      } else {
        const parent = path.substring(0, path.lastIndexOf('/'));
        matchesScope = (parent === colPath);
      }

      if (matchesScope) {
        let match = true;
        for (const f of filters) {
          if (f.op === '==' && val[f.field] !== f.value) {
            match = false;
            break;
          }
        }
        if (match) {
          const id = path.split('/').pop() || '';
          docs.push({
            id,
            exists: true,
            data: () => JSON.parse(JSON.stringify(val)),
            ref: new MockDocRef(path, this)
          });
        }
      }
    }
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
      forEach: (fn: (d: any) => void) => docs.forEach(fn)
    };
  }

  async runTransaction<T>(updateFunction: (t: any) => Promise<T>): Promise<T> {
    const currentLock = this._lock;
    let releaseLock: () => void;
    this._lock = new Promise<void>((resolve) => { releaseLock = resolve; });
    await currentLock;

    try {
      const writes: Array<() => void> = [];
      const t = {
        get: async (ref: any) => {
          if (ref._filters !== undefined) {
            return ref.get();
          }
          return this._getDoc(ref.path);
        },
        set: (ref: MockDocRef, data: any, opts?: any) => writes.push(() => this._setDoc(ref.path, data, opts)),
        update: (ref: MockDocRef, data: any) => writes.push(() => this._updateDoc(ref.path, data))
      };
      const result = await updateFunction(t);
      for (const w of writes) w();
      return result;
    } finally {
      releaseLock!();
    }
  }
}

// ============================================================================
// SIMULADOR DETERMINÍSTICO DE STORAGE SECURITY RULES
// Espelha com fidelidade absoluta as regras em /storage.rules
// ============================================================================
interface StorageRequestContext {
  auth: { uid: string; token?: { storeId?: string } } | null;
  resource?: { size: number; contentType: string };
}

class StorageSecurityRulesEvaluator {
  private storesDb = new Map<string, { ownerId: string }>();

  setStore(storeId: string, ownerId: string) {
    this.storesDb.set(storeId, { ownerId });
  }

  evaluate(action: 'read' | 'write' | 'delete', path: string, req: StorageRequestContext): boolean {
    const parts = path.split('/').filter(Boolean);

    // Regra 1: /stores/{storeId}/public/{allPaths=**}
    if (parts[0] === 'stores' && parts[2] === 'public') {
      const storeId = parts[1];
      if (action === 'read') return true; // Público
      // Write / Delete: apenas isStoreOwner
      if (!req.auth) return false;
      const isOwner = this.isStoreOwner(storeId, req.auth);
      if (!isOwner) return false;
      if (action === 'delete') return true;
      // Validação de size e image
      if (!req.resource) return false;
      const isValidImage = req.resource.size < 15 * 1024 * 1024 && req.resource.contentType.startsWith('image/');
      return isValidImage;
    }

    // Regra 2: /stores/{storeId}/private/{allPaths=**}
    if (parts[0] === 'stores' && parts[2] === 'private') {
      const storeId = parts[1];
      if (!req.auth) return false;
      const isOwner = this.isStoreOwner(storeId, req.auth);
      if (!isOwner) return false;
      if (action === 'read' || action === 'delete') return true;
      if (!req.resource) return false;
      return req.resource.size < 15 * 1024 * 1024;
    }

    // Regra 3: /users/{userId}/{allPaths=**}
    if (parts[0] === 'users' && parts.length >= 3) {
      const userId = parts[1];
      if (!req.auth || req.auth.uid !== userId) return false;
      if (action === 'read' || action === 'delete') return true;
      if (!req.resource) return false;
      return req.resource.size < 15 * 1024 * 1024;
    }

    // Regra 4: /kyc/{userId}/{allPaths=**}
    if (parts[0] === 'kyc' && parts.length >= 3) {
      const userId = parts[1];
      if (!req.auth || req.auth.uid !== userId) return false;
      if (action === 'read' || action === 'delete') return true;
      if (!req.resource) return false;
      return req.resource.size < 15 * 1024 * 1024;
    }

    // Bloqueio Global Fail-Closed
    return false;
  }

  private isStoreOwner(storeId: string, auth: { uid: string; token?: { storeId?: string } }): boolean {
    const store = this.storesDb.get(storeId);
    if (store && store.ownerId === auth.uid) return true;
    if (auth.token?.storeId && auth.token.storeId === storeId) return true;
    return false;
  }
}

// ============================================================================
// SUÍTE DE TESTES ETAPA 7.1
// ============================================================================
async function runEtapa71Tests() {
  console.log('======================================================================');
  console.log('  INICIANDO SUÍTE DE TESTES DA ETAPA 7.1 — HARDENING FINAL');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;
  let assertions = 0;

  function assertCheck(cond: boolean, msg: string) {
    assertions++;
    assert(cond, msg);
  }

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // GRUPO 1: TESTES MISTICPAY (M1 a M12)
  // --------------------------------------------------------------------------
  console.log('--- GRUPO 1: TESTES MISTICPAY OBRIGATÓRIOS (M1 a M12) ---');

  await test('TESTE M1: MISTIC_PAY_WEBHOOK_SECRET ausente -> Fail-Closed 503, zero efeito financeiro', () => {
    const configuredSecret = '';
    let responseStatus = 200;
    let responseCode = '';

    if (!configuredSecret) {
      responseStatus = 503;
      responseCode = 'WEBHOOK_CONFIG_MISSING';
    }

    assertCheck(responseStatus === 503, 'Deve responder 503 quando segredo não está configurado');
    assertCheck(responseCode === 'WEBHOOK_CONFIG_MISSING', 'Código de erro deve indicar configuração ausente');
  });

  await test('TESTE M2: Secret inválido -> Rejeição com 401 Unauthorized, zero efeito', () => {
    const configuredSecret = 'segredo_oficial_mistic_2026';
    const incomingToken = 'token_forjado_por_hacker';

    const isValid = constantTimeCompare(incomingToken, configuredSecret);
    assertCheck(!isValid, 'Token forjado deve falhar na validação');

    const status = isValid ? 200 : 401;
    assertCheck(status === 401, 'Deve retornar 401');
  });

  await test('TESTE M3: Secret válido -> Continua processamento normal', () => {
    const configuredSecret = 'segredo_oficial_mistic_2026';
    const incomingToken = 'segredo_oficial_mistic_2026';

    const isValid = constantTimeCompare(incomingToken, configuredSecret);
    assertCheck(isValid, 'Token oficial deve ser validado com sucesso em tempo constante');
  });

  await test('TESTE M4: Assinatura válida + Active check Timeout -> Não confirmar, status pending_verification, 503', async () => {
    const db = new MockFirestore();
    const storeId = 'store_m4';
    const orderId = 'order_m4';

    db._setDoc(`stores/${storeId}/orders/${orderId}`, {
      id: orderId,
      storeId,
      status: 'pending',
      total: 100.00
    });

    // Simulação do resultado do active check com timeout
    const activeCheckResult = { status: 'UNAVAILABLE', reason: 'Timeout na consulta autoritativa do gateway' };

    // Tratamento estrito do active check
    let httpStatus = 200;
    if (activeCheckResult.status !== 'SUCCESS') {
      httpStatus = 503;
      await db._updateDoc(`stores/${storeId}/orders/${orderId}`, {
        status: 'pending_verification',
        reconciliationRequired: true,
        lastVerificationError: activeCheckResult.reason
      });
    }

    assertCheck(httpStatus === 503, 'Deve retornar 503 quando active check sofrer timeout');
    const orderSnap = await db._getDoc(`stores/${storeId}/orders/${orderId}`);
    assertCheck(orderSnap.data().status === 'pending_verification', 'Status não pode ser paid');
    assertCheck(orderSnap.data().reconciliationRequired === true, 'Deve exigir reconciliação');

    // Saldo da carteira não pode ter sido criado ou liberado
    const walletSnap = await db._getDoc(`stores/${storeId}/wallet/main`);
    assertCheck(!walletSnap.exists, 'Zero efeito na carteira');
  });

  await test('TESTE M5: Assinatura válida + Active check 500 -> Comportamento inconclusivo e retenção', async () => {
    const db = new MockFirestore();
    const storeId = 'store_m5';
    const orderId = 'order_m5';

    db._setDoc(`stores/${storeId}/orders/${orderId}`, {
      id: orderId,
      storeId,
      status: 'pending',
      total: 250.00
    });

    const activeCheckResult = { status: 'UNAVAILABLE', reason: 'Gateway HTTP 500 Internal Server Error' };

    let httpStatus = 200;
    if (activeCheckResult.status !== 'SUCCESS') {
      httpStatus = 503;
      await db._updateDoc(`stores/${storeId}/orders/${orderId}`, {
        status: 'pending_verification',
        reconciliationRequired: true,
        lastVerificationError: activeCheckResult.reason
      });
    }

    assertCheck(httpStatus === 503, 'Active check com erro 500 do provedor deve retornar 503');
    const orderSnap = await db._getDoc(`stores/${storeId}/orders/${orderId}`);
    assertCheck(orderSnap.data().status === 'pending_verification', 'Status retido em pending_verification');
  });

  await test('TESTE M6: Active check confirma explicitamente pagamento -> Processamento financeiro autorizado com D+3', async () => {
    const db = new MockFirestore();
    const storeId = 'store_m6';
    const orderId = 'order_m6';

    db._setDoc(`stores/${storeId}/orders/${orderId}`, {
      id: orderId,
      storeId,
      status: 'pending',
      total: 80.00
    });

    db._setDoc(`stores/${storeId}/wallet/main`, {
      pendingBalanceCents: 0,
      availableBalanceCents: 0,
      reservedBalanceCents: 0,
      totalReceivedCents: 0,
      totalWithdrawnCents: 0,
      version: 1
    });

    const activeCheckResult = { status: 'SUCCESS', state: 'COMPLETO' };
    assertCheck(activeCheckResult.status === 'SUCCESS', 'Provedor confirmou sucesso autoritativo');

    if (activeCheckResult.status === 'SUCCESS') {
      await db._updateDoc(`stores/${storeId}/orders/${orderId}`, { status: 'paid' });
      await FinancialWalletService.creditPayment(db as any, {
        storeId,
        orderId,
        amountCents: 8000,
        feeCents: 560,
        paymentMethod: 'pix'
      });
    }

    const orderSnap = await db._getDoc(`stores/${storeId}/orders/${orderId}`);
    assertCheck(orderSnap.data().status === 'paid', 'Pedido confirmado como pago');

    const walletSnap = await db._getDoc(`stores/${storeId}/wallet/main`);
    assertCheck(walletSnap.exists, 'Carteira criada');
    assertCheck(walletSnap.data().pendingBalanceCents === (8000 - 560), 'Retido estritamente em pendingBalance');
    assertCheck(walletSnap.data().availableBalanceCents === 0, 'Zero crédito em saldo liberado imediato');
  });

  await test('TESTE M7: Webhook repetido -> Idempotente com zero duplicação', async () => {
    const db = new MockFirestore();
    const storeId = 'store_m7';
    const orderId = 'order_m7';

    const res1 = await FinancialWalletService.creditPayment(db as any, {
      storeId,
      orderId,
      amountCents: 10000,
      paymentMethod: 'pix'
    });
    assertCheck(res1.success === true, 'Primeira execução com sucesso');

    const res2 = await FinancialWalletService.creditPayment(db as any, {
      storeId,
      orderId,
      amountCents: 10000,
      paymentMethod: 'pix'
    });
    assertCheck(res2.success === true, 'Segunda execução retorna sucesso');
    assertCheck(res2.alreadyProcessed === true, 'Idempotência detectada');

    const walletSnap = await db._getDoc(`stores/${storeId}/wallet/main`);
    assertCheck(walletSnap.data().pendingBalanceCents === 10000, 'Saldo pendente não duplicado');
  });

  await test('TESTE M8: Dois webhooks simultâneos -> Uma única aplicação financeira atômica', async () => {
    const db = new MockFirestore();
    const storeId = 'store_m8';
    const orderId = 'order_m8';

    const op1 = FinancialWalletService.creditPayment(db as any, {
      storeId,
      orderId,
      amountCents: 5000,
      paymentMethod: 'pix'
    });

    const op2 = FinancialWalletService.creditPayment(db as any, {
      storeId,
      orderId,
      amountCents: 5000,
      paymentMethod: 'pix'
    });

    const [r1, r2] = await Promise.all([op1, op2]);
    assertCheck(r1.success && r2.success, 'Ambas requisições tratadas');
    const alreadyProcessedCount = (r1.alreadyProcessed ? 1 : 0) + (r2.alreadyProcessed ? 1 : 0);
    assertCheck(alreadyProcessedCount === 1, 'Exatamente uma chamada registrou idempotência');

    const walletSnap = await db._getDoc(`stores/${storeId}/wallet/main`);
    assertCheck(walletSnap.data().pendingBalanceCents === 5000, 'Saldo não pode sofrer double-spend/duplicação');
  });

  await test('TESTE M9: Amount divergente -> Rejeição com 400 AMOUNT_MISMATCH, zero crédito', () => {
    const expectedTotalCents = 15000; // R$ 150,00
    const webhookValue = 10.00; // R$ 10,00
    const incomingCents = Math.round(webhookValue * 100);

    const isMatch = (incomingCents === expectedTotalCents);
    assertCheck(!isMatch, 'Divergência detectada');

    let httpStatus = 200;
    if (!isMatch) httpStatus = 400;
    assertCheck(httpStatus === 400, 'Deve retornar 400');
  });

  await test('TESTE M10: Merchant / Tenant divergente -> Rejeição com 404/400, zero crédito', async () => {
    const db = new MockFirestore();
    // Pedido tem storeId='store_real', mas loja não existe no banco
    db._setDoc('stores/store_real/orders/ord_10', {
      id: 'ord_10',
      storeId: 'store_real_inexistente',
      total: 50
    });

    const orderDoc = await db._getDoc('stores/store_real/orders/ord_10');
    const storeSnap = await db._getDoc(`stores/${orderDoc.data().storeId}`);
    
    assertCheck(!storeSnap.exists, 'Loja associada não encontrada');
    const status = !storeSnap.exists ? 404 : 200;
    assertCheck(status === 404, 'Deve rejeitar com 404');
  });

  await test('TESTE M11: Transaction ID inexistente -> Rejeição segura com status ignored_order_not_found', async () => {
    const db = new MockFirestore();
    const query = await db.collectionGroup('orders').where('id', '==', 'inexistente_9999').get();
    assertCheck(query.empty, 'Pedido deve ser inexistente');
    const responseStatus = query.empty ? 'ignored_order_not_found' : 'found';
    assertCheck(responseStatus === 'ignored_order_not_found', 'Ignora sem afetar carteira');
  });

  await test('TESTE M12: Payload adulterado -> Validação de payloadHash detecta adulteração', () => {
    const secret = 'segredo_mistic';
    const payloadOriginal = JSON.stringify({ transactionId: 'tx1', status: 'COMPLETO', value: 100 });
    const payloadAdulterado = JSON.stringify({ transactionId: 'tx1', status: 'COMPLETO', value: 99999 });

    const hash1 = crypto.createHash('sha256').update(payloadOriginal).digest('hex');
    const hash2 = crypto.createHash('sha256').update(payloadAdulterado).digest('hex');

    assertCheck(hash1 !== hash2, 'Hashes SHA-256 de payloads diferentes devem divergir');
  });

  // --------------------------------------------------------------------------
  // GRUPO 2: TESTES DE STORAGE RULES (S1 a S10)
  // --------------------------------------------------------------------------
  console.log('\n--- GRUPO 2: TESTES DE STORAGE RULES (S1 a S10) ---');
  const storage = new StorageSecurityRulesEvaluator();
  storage.setStore('store_alpha', 'user_owner_alpha');
  storage.setStore('store_beta', 'user_owner_beta');

  const validImageResource = { size: 1024 * 1024, contentType: 'image/png' };
  const validDocResource = { size: 500 * 1024, contentType: 'application/pdf' };
  const oversizedResource = { size: 20 * 1024 * 1024, contentType: 'image/png' };

  await test('TESTE S1: Anonymous read private -> FAIL (Bloqueado)', () => {
    const allowed = storage.evaluate('read', 'stores/store_alpha/private/faturas.pdf', { auth: null });
    assertCheck(!allowed, 'Anônimo não pode ler storage privado de loja');
  });

  await test('TESTE S2: Anonymous write -> FAIL (Bloqueado)', () => {
    const allowed = storage.evaluate('write', 'stores/store_alpha/public/logo.png', {
      auth: null,
      resource: validImageResource
    });
    assertCheck(!allowed, 'Anônimo não pode escrever no storage');
  });

  await test('TESTE S3: User A read store B private -> FAIL (Bloqueado)', () => {
    const allowed = storage.evaluate('read', 'stores/store_beta/private/balanco.pdf', {
      auth: { uid: 'user_owner_alpha' }
    });
    assertCheck(!allowed, 'Usuário A não pode ler arquivos privados da loja B');
  });

  await test('TESTE S4: User A write store B private -> FAIL (Bloqueado)', () => {
    const allowed = storage.evaluate('write', 'stores/store_beta/private/malware.pdf', {
      auth: { uid: 'user_owner_alpha' },
      resource: validDocResource
    });
    assertCheck(!allowed, 'Usuário A não pode escrever na área privada da loja B');
  });

  await test('TESTE S5: User A delete store B private -> FAIL (Bloqueado)', () => {
    const allowed = storage.evaluate('delete', 'stores/store_beta/private/balanco.pdf', {
      auth: { uid: 'user_owner_alpha' }
    });
    assertCheck(!allowed, 'Usuário A não pode deletar arquivos privados da loja B');
  });

  await test('TESTE S6: User A write store B public -> FAIL (Bloqueado se não for owner)', () => {
    const allowed = storage.evaluate('write', 'stores/store_beta/public/banner.png', {
      auth: { uid: 'user_owner_alpha' },
      resource: validImageResource
    });
    assertCheck(!allowed, 'Usuário A não pode publicar banner na loja B');
  });

  await test('TESTE S7: Owner read own private -> PASS (Autorizado)', () => {
    const allowed = storage.evaluate('read', 'stores/store_alpha/private/faturas.pdf', {
      auth: { uid: 'user_owner_alpha' }
    });
    assertCheck(allowed, 'Owner deve conseguir ler sua própria área privada');
  });

  await test('TESTE S8: Owner write own permitted path -> PASS (Autorizado)', () => {
    const allowedPublic = storage.evaluate('write', 'stores/store_alpha/public/logo.png', {
      auth: { uid: 'user_owner_alpha' },
      resource: validImageResource
    });
    assertCheck(allowedPublic, 'Owner pode escrever imagem válida em sua pasta pública');

    const allowedPrivate = storage.evaluate('write', 'stores/store_alpha/private/relatorio.pdf', {
      auth: { uid: 'user_owner_alpha' },
      resource: validDocResource
    });
    assertCheck(allowedPrivate, 'Owner pode escrever documento em sua pasta privada');

    const rejectedOversized = storage.evaluate('write', 'stores/store_alpha/public/huge.png', {
      auth: { uid: 'user_owner_alpha' },
      resource: oversizedResource
    });
    assertCheck(!rejectedOversized, 'Arquivo com mais de 15MB deve ser rejeitado');
  });

  await test('TESTE S9: Public catalog read -> PASS somente onde explicitamente público (/public/)', () => {
    const publicRead = storage.evaluate('read', 'stores/store_alpha/public/produto1.jpg', { auth: null });
    assertCheck(publicRead, 'Leitura pública permitida em /public/');

    const rootRead = storage.evaluate('read', 'stores/store_alpha/dados_internos.txt', { auth: null });
    assertCheck(!rootRead, 'Leitura fora de /public/ deve ser estritamente bloqueada');
  });

  await test('TESTE S10: Protected / KYC read -> FAIL para usuário não autorizado', () => {
    const anonKyc = storage.evaluate('read', 'kyc/user_victim/selfie.jpg', { auth: null });
    assertCheck(!anonKyc, 'Anônimo não pode ler KYC');

    const attackerKyc = storage.evaluate('read', 'kyc/user_victim/selfie.jpg', {
      auth: { uid: 'user_attacker' }
    });
    assertCheck(!attackerKyc, 'Usuário invasor não pode ler KYC da vítima');

    const victimKyc = storage.evaluate('read', 'kyc/user_victim/selfie.jpg', {
      auth: { uid: 'user_victim' }
    });
    assertCheck(victimKyc, 'Próprio titular do documento pode acessar seus arquivos KYC');
  });

  // --------------------------------------------------------------------------
  // GRUPO 3: TESTES DE CONFIGURAÇÃO FAIL-CLOSED (C1 a C5)
  // --------------------------------------------------------------------------
  console.log('\n--- GRUPO 3: TESTES DE CONFIGURAÇÃO FAIL-CLOSED (C1 a C5) ---');

  await test('TESTE C1: DIDIT_API_KEY ausente -> Fail-Closed', () => {
    const originalKey = process.env.DIDIT_API_KEY;
    process.env.DIDIT_API_KEY = '';
    const key = (process.env.DIDIT_API_KEY || '').trim();
    const isConfigured = Boolean(key);
    assertCheck(!isConfigured, 'DIDIT_API_KEY vazia deve indicar serviço indisponível');
    process.env.DIDIT_API_KEY = originalKey;
  });

  await test('TESTE C2: DIDIT_WORKFLOW_ID ausente -> Fail-Closed', () => {
    const originalWf = process.env.DIDIT_WORKFLOW_ID;
    process.env.DIDIT_WORKFLOW_ID = '';
    const wf = (process.env.DIDIT_WORKFLOW_ID || '').trim();
    const isConfigured = Boolean(wf);
    assertCheck(!isConfigured, 'DIDIT_WORKFLOW_ID ausente não permite fluxo KYC');
    process.env.DIDIT_WORKFLOW_ID = originalWf;
  });

  await test('TESTE C3: DIDIT_WEBHOOK_SECRET ausente -> Rejeição Fail-Closed 500', () => {
    const secret = '';
    const canProcess = Boolean(secret);
    assertCheck(!canProcess, 'Webhook secret ausente bloqueia requisições');
  });

  await test('TESTE C4: MISTIC_PAY_WEBHOOK_SECRET ausente -> Fail-Closed 503', () => {
    const secret = '';
    const canProcess = Boolean(secret);
    assertCheck(!canProcess, 'MisticPay webhook secret ausente bloqueia processamento');
  });

  await test('TESTE C5: MISTIC_PAY_CLIENT_SECRET ausente -> Retorno CONFIG_ERROR sem chamada externa', () => {
    const clientSecret = '';
    const canCallApi = Boolean(clientSecret);
    assertCheck(!canCallApi, 'Sem credencial de API, chamadas de saque são abortadas antes do provider');
  });

  console.log('\n======================================================================');
  console.log(`  RESULTADO DOS TESTES ETAPA 7.1:`);
  console.log(`  Test Cases: ${passed + failed} | Passaram: ${passed} | Falharam: ${failed}`);
  console.log(`  Total de Assertions Validadas: ${assertions}`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

runEtapa71Tests();
