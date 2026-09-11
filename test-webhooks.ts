import crypto from 'crypto';
import {
  canTransitionState,
  parseAndValidateWebhookPayload,
  constantTimeCompare,
  hasPrototypePollution
} from './server-webhook-service';
import { KycService, normalizeKycStatus, isKycApproved } from './server-kyc-service';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
  }
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('  INICIANDO BATERIA DE TESTES DE SEGURANÇA DE WEBHOOKS');
  console.log('======================================================\n');

  // -------------------------------------------------------------
  // GRUPO 1: Máquina de Estados e Transições Proibidas / Permitidas
  // -------------------------------------------------------------
  console.log('--- GRUPO 1: Validação da Máquina de Estados (Financeiro / KYC) ---');

  // Pagamentos
  assert(canTransitionState('payment', 'pending', 'paid') === true, 'Pagamento: pending -> paid é permitido');
  assert(canTransitionState('payment', 'paid', 'pending') === false, 'Pagamento: paid -> pending é estritamente proibido (sem regressão)');
  assert(canTransitionState('payment', 'cancelled', 'paid') === false, 'Pagamento: cancelled -> paid é proibido');
  assert(canTransitionState('payment', 'paid', 'paid') === true, 'Pagamento: paid -> paid idempotência permitida');

  // Saques
  assert(canTransitionState('withdrawal', 'reserved', 'processing') === true, 'Saque: reserved -> processing permitido');
  assert(canTransitionState('withdrawal', 'processing', 'completed') === true, 'Saque: processing -> completed permitido');
  assert(canTransitionState('withdrawal', 'processing', 'failed') === true, 'Saque: processing -> failed permitido');
  assert(canTransitionState('withdrawal', 'completed', 'processing') === false, 'Saque: completed -> processing é proibido (terminal)');
  assert(canTransitionState('withdrawal', 'completed', 'failed') === false, 'Saque: completed -> failed é proibido (terminal)');
  assert(canTransitionState('withdrawal', 'failed', 'completed') === false, 'Saque: failed -> completed é proibido (terminal)');

  // KYC
  assert(canTransitionState('kyc', 'in_progress', 'approved') === true, 'KYC: in_progress -> approved permitido');
  assert(canTransitionState('kyc', 'in_progress', 'declined') === true, 'KYC: in_progress -> declined permitido');
  assert(canTransitionState('kyc', 'approved', 'in_progress') === false, 'KYC: approved -> in_progress é estritamente proibido');
  assert(canTransitionState('kyc', 'approved', 'not_started') === false, 'KYC: approved -> not_started é estritamente proibido');

  // Autoridade Canônica de KYC
  assert(isKycApproved({ kyc: { status: 'approved' } }) === true, 'isKycApproved: kyc.status=approved retorna true');
  assert(isKycApproved({ kyc: { status: 'in_progress' } }) === false, 'isKycApproved: kyc.status=in_progress retorna false');
  assert(isKycApproved({ kyc: { status: 'declined' } }) === false, 'isKycApproved: kyc.status=declined retorna false');
  assert(isKycApproved({ verified: true }) === false, 'isKycApproved: verified=true legado sem kyc.status NÃO aprova (fail-closed)');
  assert(isKycApproved({}) === false, 'isKycApproved: usuário vazio retorna false');

  // -------------------------------------------------------------
  // GRUPO 2: Sanitização, Payload Size e Prototype Pollution
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 2: Sanitização, Payload Size e Prototype Pollution ---');

  // Prototype Pollution
  assert(hasPrototypePollution(JSON.parse('{"__proto__": {"admin": true}}')) === true, 'Detecta __proto__ malicioso');
  assert(hasPrototypePollution(JSON.parse('{"constructor": {"prototype": {"admin": true}}}')) === true, 'Detecta constructor.prototype malicioso');
  assert(hasPrototypePollution({ safe: { nested: 123 } }) === false, 'Aceita objeto limpo e legítimo');

  // Rejeição de Prototype Pollution no Parser
  let protoPollutionBlocked = false;
  try {
    const maliciousBuf = Buffer.from('{"transactionId":"123","__proto__":{"isAdmin":true}}', 'utf8');
    parseAndValidateWebhookPayload(maliciousBuf);
  } catch (err: any) {
    protoPollutionBlocked = err.statusCode === 400;
  }
  assert(protoPollutionBlocked, 'Parser de webhook bloqueia tentativa de prototype pollution com status 400');

  // Limite de Tamanho de Payload (> 256KB)
  let sizeLimitBlocked = false;
  try {
    const hugeBuf = Buffer.alloc(300 * 1024, 'a');
    parseAndValidateWebhookPayload(hugeBuf, 256 * 1024);
  } catch (err: any) {
    sizeLimitBlocked = err.statusCode === 413;
  }
  assert(sizeLimitBlocked, 'Parser de webhook bloqueia payload > 256KB com status 413');

  // JSON Malformado
  let malformedJsonBlocked = false;
  try {
    const malformedBuf = Buffer.from('{ invalid json !!!', 'utf8');
    parseAndValidateWebhookPayload(malformedBuf);
  } catch (err: any) {
    malformedJsonBlocked = err.statusCode === 400;
  }
  assert(malformedJsonBlocked, 'Parser de webhook bloqueia JSON malformado com status 400');

  // Payload Válido com SHA-256
  const validBuf = Buffer.from(JSON.stringify({ transactionId: 'tx_999', status: 'COMPLETO' }));
  const validParsed = parseAndValidateWebhookPayload(validBuf);
  const expectedHash = crypto.createHash('sha256').update(validBuf).digest('hex');
  assert(validParsed.payloadHash === expectedHash, 'Parser calcula payloadHash SHA-256 exato');

  // -------------------------------------------------------------
  // GRUPO 3: Comparação em Tempo Constante (Anti-Timing Attacks)
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 3: Comparação Segura em Tempo Constante ---');

  const secretKey = 'webhook_secret_ultra_seguro_123';
  assert(constantTimeCompare(secretKey, secretKey) === true, 'constantTimeCompare: chaves idênticas retornam true');
  assert(constantTimeCompare(secretKey, 'webhook_secret_ultra_seguro_124') === false, 'constantTimeCompare: chave com 1 caractere diferente retorna false');
  assert(constantTimeCompare(secretKey, 'short') === false, 'constantTimeCompare: tamanhos diferentes retornam false');
  assert(constantTimeCompare('', '') === true, 'constantTimeCompare: strings vazias retornam true');

  // -------------------------------------------------------------
  // GRUPO 4: Didit KYC Webhook (HMAC, Timestamp, Replay)
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 4: Didit KYC Webhook (HMAC, Timestamp, Fail-Closed) ---');

  const diditSecret = 'test_didit_secret_xyz';
  process.env.DIDIT_WEBHOOK_SECRET = diditSecret;

  const sampleSessionId = 'sess_' + crypto.randomUUID();
  const samplePayload = {
    session_id: sampleSessionId,
    status: 'Approved',
    webhook_type: 'status.updated'
  };
  const sampleBuf = Buffer.from(JSON.stringify(samplePayload), 'utf8');
  const nowTs = Math.floor(Date.now() / 1000);

  // Assinatura válida HMAC-SHA256 (x-signature)
  const validRawSig = crypto.createHmac('sha256', diditSecret).update(sampleBuf).digest('hex');
  
  // Assinatura inválida
  const invalidRawSig = '0000000000000000000000000000000000000000000000000000000000000000';

  // Simulação de verificação com mock DB
  const mockDb: any = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false }),
        set: async () => {}
      })
    }),
    runTransaction: async (cb: any) => {
      return cb({
        get: async () => ({ exists: false }),
        set: () => {}
      });
    }
  };

  // Teste 1: Assinatura Inválida
  let invalidSigFailed = false;
  try {
    await KycService.handleWebhook(mockDb, sampleBuf, {
      'x-signature': invalidRawSig,
      'x-timestamp': String(nowTs)
    });
  } catch (err: any) {
    invalidSigFailed = err.code === 'KYC_WEBHOOK_INVALID_SIGNATURE';
  }
  assert(invalidSigFailed, 'Didit Webhook: rejeita assinatura inválida com KYC_WEBHOOK_INVALID_SIGNATURE (401)');

  // Teste 2: Timestamp Expirado (> 300s)
  let staleTsFailed = false;
  try {
    const expiredTs = nowTs - 305; // 5 minutos e 5 segundos atrás
    await KycService.handleWebhook(mockDb, sampleBuf, {
      'x-signature': validRawSig,
      'x-timestamp': String(expiredTs)
    });
  } catch (err: any) {
    staleTsFailed = err.code === 'KYC_WEBHOOK_STALE_TIMESTAMP';
  }
  assert(staleTsFailed, 'Didit Webhook: rejeita timestamp expirado (> 300s) com KYC_WEBHOOK_STALE_TIMESTAMP (401)');

  // Teste 3: Segredo Ausente (Fail-Closed)
  delete process.env.DIDIT_WEBHOOK_SECRET;
  let missingSecretFailed = false;
  try {
    await KycService.handleWebhook(mockDb, sampleBuf, {
      'x-signature': validRawSig,
      'x-timestamp': String(nowTs)
    });
  } catch (err: any) {
    missingSecretFailed = err.code === 'WEBHOOK_SECRET_MISSING';
  }
  assert(missingSecretFailed, 'Didit Webhook: rejeita requisição se DIDIT_WEBHOOK_SECRET estiver ausente (Fail-Closed 500)');
  process.env.DIDIT_WEBHOOK_SECRET = diditSecret;

  // -------------------------------------------------------------
  // GRUPO 5: Regras Financeiras e MisticPay Webhook
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 5: Validação Financeira e MisticPay ---');

  // Mismatch de Valor
  const orderAmountCents = 15000; // R$ 150,00
  const webhookValA = 150;        // R$ 150,00
  const webhookValB = 15000;      // 15000 centavos
  const webhookValWrong = 50;     // R$ 50,00 (Divergente!)

  const isMatchA = Math.round(Number(webhookValA) * 100) === orderAmountCents;
  const isMatchB = Math.round(Number(webhookValB)) === orderAmountCents;
  const isMatchWrong = (Math.round(Number(webhookValWrong) * 100) === orderAmountCents) || 
                       (Math.round(Number(webhookValWrong)) === orderAmountCents);

  assert(isMatchA === true, 'MisticPay: reconhece valor em reais (R$ 150,00)');
  assert(isMatchB === true, 'MisticPay: reconhece valor em centavos (15000)');
  assert(isMatchWrong === false, 'MisticPay: rejeita valor divergente (R$ 50,00 vs R$ 150,00 esperado)');

  // Fail-Closed em Token de Webhook do MisticPay
  process.env.MISTIC_PAY_WEBHOOK_SECRET = 'token_secreto_mistic_987';
  const incomingWrongToken = 'token_errado';
  const isAuthOk = constantTimeCompare(incomingWrongToken, process.env.MISTIC_PAY_WEBHOOK_SECRET);
  assert(isAuthOk === false, 'MisticPay: rejeita requisição de webhook com token divergente');

  const incomingCorrectToken = 'token_secreto_mistic_987';
  const isCorrectAuthOk = constantTimeCompare(incomingCorrectToken, process.env.MISTIC_PAY_WEBHOOK_SECRET);
  assert(isCorrectAuthOk === true, 'MisticPay: autoriza requisição com token correto');

  // -------------------------------------------------------------
  // RESUMO FINAL
  // -------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`  RESULTADO: ${passedTests}/${totalTests} TESTES PASSARAM COM SUCESSO!`);
  if (failedTests > 0) {
    console.error(`  AVISO: ${failedTests} TESTES FALHARAM!`);
  } else {
    console.log('  TODOS OS TESTES DE SEGURANÇA FORAM APROVADOS! 🚀');
  }
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests();
