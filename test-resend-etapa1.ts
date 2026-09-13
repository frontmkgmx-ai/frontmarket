import { test } from 'node:test';
import assert from 'node:assert';
import { sendEmail } from './server-email.js';

test('Resend Etapa 1 - Send Email Service', async (t) => {
  // Test 1: Sem API KEY
  await t.test('Sem RESEND_API_KEY falha', async () => {
    const backupKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const res = await sendEmail({ to: 'teste@frontmk.online', subject: 'A', html: '<b>A</b>' });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error?.includes('CONFIGURATION_ERROR'), true);
    if (backupKey !== undefined) process.env.RESEND_API_KEY = backupKey;
  });

  // Test 4: Destinatário inválido
  await t.test('Destinatário vazio', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    const res = await sendEmail({ to: '', subject: 'A', html: '<b>A</b>' });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error?.includes('VALIDATION_ERROR'), true);
  });

  await t.test('Destinatário inválido', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    const res = await sendEmail({ to: 'invalido', subject: 'A', html: '<b>A</b>' });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error?.includes('VALIDATION_ERROR'), true);
  });

  await t.test('Assunto inválido', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    const res = await sendEmail({ to: 'teste@frontmk.online', subject: '', html: '<b>A</b>' });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error?.includes('VALIDATION_ERROR'), true);
  });
});
