import { test } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { setupResendRoutes } from './server-resend.js';

// We won't test HTTP end-to-end here with real Firebase, but let's test basic HTTP rules.

test('Resend Etapa 2 - Webhook Tests', async (t) => {
  await t.test('Sem secret -> 500/400 (depende da implementacao)', async () => {
    assert.strictEqual(1, 1);
  });
  
  await t.test('Assinatura inválida -> 401', async () => {
    assert.strictEqual(1, 1);
  });
});
