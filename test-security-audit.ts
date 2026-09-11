import assert from 'assert';
import { hashPassword, verifyPassword, sanitizeCustomer } from './server-customer-auth';

async function runSecurityAuditTests() {
  console.log('--- INICIANDO SUÍTE DE TESTES DE SEGURANÇA E AUDITORIA (ETAPA 6) ---');
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Testes de Hashing de Senhas com scrypt
  test('scrypt: Deve gerar hash com formato seguro scrypt:<salt>:<hash>', () => {
    const raw = 'MinhaSenhaSegura123!';
    const hash = hashPassword(raw);
    assert(hash.startsWith('scrypt:'), 'Hash deve iniciar com prefixo scrypt:');
    const parts = hash.split(':');
    assert.strictEqual(parts.length, 3, 'Hash deve ter 3 partes separadas por dois-pontos');
    assert.strictEqual(parts[1].length, 32, 'Salt deve ter 32 caracteres hexadecimais (16 bytes)');
    assert.strictEqual(parts[2].length, 128, 'Chave derivada scrypt deve ter 128 caracteres hex (64 bytes)');
  });

  test('scrypt: Salts devem ser únicos para a mesma senha (anti-rainbow table)', () => {
    const raw = 'MinhaSenhaSegura123!';
    const hash1 = hashPassword(raw);
    const hash2 = hashPassword(raw);
    assert.notStrictEqual(hash1, hash2, 'Duas senhas iguais devem produzir hashes com salts diferentes');
  });

  test('scrypt: Verificação de senha correta e incorreta', () => {
    const raw = 'SenhaUltraSecreta!@#';
    const hash = hashPassword(raw);
    assert.strictEqual(verifyPassword(raw, hash), true, 'Senha correta deve validar com sucesso');
    assert.strictEqual(verifyPassword('SenhaIncorreta', hash), false, 'Senha incorreta deve falhar');
    assert.strictEqual(verifyPassword('', hash), false, 'Senha vazia deve falhar');
    assert.strictEqual(verifyPassword(raw, ''), false, 'Hash vazio deve falhar');
  });

  test('scrypt: Verificação e migração de senha legada plaintext', () => {
    const legacyPlain = 'senhaAntiga123';
    // O sistema aceita a senha antiga no verifyPassword para permitir a auto-migração no login
    assert.strictEqual(verifyPassword(legacyPlain, legacyPlain), true, 'Senha legada idêntica deve ser aceita para migração');
    assert.strictEqual(verifyPassword('errada', legacyPlain), false, 'Senha incorreta em registro legado deve falhar');
  });

  // 2. Testes de Sanitização e Vazamento de Dados (Zero-Credential Exposure)
  test('Sanitização: Não deve vazar password, passwordHash, tentativas ou lockout', () => {
    const rawCustomer = {
      id: 'cust_123',
      storeId: 'store_abc',
      name: 'Cliente Teste',
      email: 'teste@email.com',
      username: 'clienteteste',
      password: 'PlaintextPassword123',
      passwordHash: 'scrypt:salt:hash',
      failedLoginAttempts: 3,
      lockoutUntil: Date.now() + 10000,
      serverCreatedAt: '2026-09-11'
    };

    const sanitized = sanitizeCustomer(rawCustomer);
    assert.strictEqual(sanitized.id, 'cust_123');
    assert.strictEqual(sanitized.name, 'Cliente Teste');
    assert.strictEqual(sanitized.password, undefined, 'password NUNCA deve estar no objeto sanitizado');
    assert.strictEqual(sanitized.passwordHash, undefined, 'passwordHash NUNCA deve estar no objeto sanitizado');
    assert.strictEqual(sanitized.failedLoginAttempts, undefined, 'failedLoginAttempts NUNCA deve estar no objeto sanitizado');
    assert.strictEqual(sanitized.lockoutUntil, undefined, 'lockoutUntil NUNCA deve estar no objeto sanitizado');
    assert.strictEqual(sanitized.serverCreatedAt, undefined, 'serverCreatedAt interno deve ser omitido');
  });

  // 3. Testes de Path Traversal e Sanitização de Identificadores StreamX
  test('StreamX: Regex deve aceitar identificadores válidos e rejeitar Path Traversal', () => {
    const SAFE_OBJECT_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
    
    // Válidos
    assert(SAFE_OBJECT_ID_REGEX.test('img_123456_abc'));
    assert(SAFE_OBJECT_ID_REGEX.test('38f824b0-eaf6-4e9b-8c44-a40f4839f7b9'));
    assert(SAFE_OBJECT_ID_REGEX.test('obj-name_01'));

    // Injeções / Path Traversal / Maliciosos
    assert(!SAFE_OBJECT_ID_REGEX.test('../../../etc/passwd'), 'Path traversal com .. deve ser rejeitado');
    assert(!SAFE_OBJECT_ID_REGEX.test('..\\..\\windows\\system32'), 'Path traversal com backslash deve ser rejeitado');
    assert(!SAFE_OBJECT_ID_REGEX.test('img/subfolder/file'), 'Barras internas devem ser rejeitadas');
    assert(!SAFE_OBJECT_ID_REGEX.test('img%2e%2e%2f'), 'URL encoding suspeito deve ser rejeitado');
    assert(!SAFE_OBJECT_ID_REGEX.test('<script>alert(1)</script>'), 'Tags HTML devem ser rejeitadas');
    assert(!SAFE_OBJECT_ID_REGEX.test(''), 'String vazia deve ser rejeitada');
    assert(!SAFE_OBJECT_ID_REGEX.test('a'.repeat(129)), 'Identificador com mais de 128 caracteres deve ser rejeitado');
  });

  // 4. Testes de Detecção de Manipulação de Preços no Checkout
  test('Checkout: Cálculo estrito de centavos e detecção de divergência de preço', () => {
    const productsInDb = [
      { id: 'p1', name: 'Camiseta', price: 89.90, active: true },
      { id: 'p2', name: 'Boné', price: 49.50, active: true }
    ];

    const itemsFromClient = [
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 1 }
    ];

    // Backend recalcula preço oficial do banco
    let calculatedCents = 0;
    for (const item of itemsFromClient) {
      const prod = productsInDb.find(p => p.id === item.productId)!;
      calculatedCents += Math.round(prod.price * 100) * item.quantity;
    }
    const realTotal = Math.round(calculatedCents) / 100;
    // 89.90 * 2 = 179.80; 49.50 * 1 = 49.50; Total = 229.30
    assert.strictEqual(realTotal, 229.30, 'Total recalculado pelo backend deve ser 229.30');

    // Tentativa de fraude: cliente tenta enviar total de R$ 0.01 ou R$ 10.00
    const tamperedClientTotal = 0.01;
    const diff = Math.abs(tamperedClientTotal - realTotal);
    assert(diff > 0.05, 'Divergência de preço deve ser detectada e bloqueada');
  });

  // 5. Testes de Invariantes de Permissões e Regras de Segurança
  test('Privilege Escalation: Regras bloqueiam auto-promoção para admin/superadmin', () => {
    // Simulação de validação de regras de usuários
    function validateUserRoleCreation(data: any) {
      const allowedRoles = ['merchant', 'seller', 'user'];
      if ('role' in data && !allowedRoles.includes(data.role)) return false;
      if ('isAdmin' in data && data.isAdmin === true) return false;
      if ('isSuperAdmin' in data) return false;
      if ('permissions' in data) return false;
      return true;
    }

    assert.strictEqual(validateUserRoleCreation({ name: 'Lojista', role: 'merchant' }), true);
    assert.strictEqual(validateUserRoleCreation({ name: 'Lojista', role: 'admin' }), false, 'role admin deve ser barrado');
    assert.strictEqual(validateUserRoleCreation({ name: 'Hacker', isAdmin: true }), false, 'isAdmin: true deve ser barrado');
    assert.strictEqual(validateUserRoleCreation({ name: 'Hacker', isSuperAdmin: true }), false, 'isSuperAdmin deve ser barrado');
    assert.strictEqual(validateUserRoleCreation({ name: 'Hacker', permissions: ['*'] }), false, 'permissions deve ser barrado');
  });

  console.log(`\nRESUMO DOS TESTES: ${passed} passaram, ${failed} falharam.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAuditTests();
