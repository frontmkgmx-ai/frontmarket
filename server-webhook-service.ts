import crypto from 'crypto';
import express from 'express';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/**
 * Tipos canônicos de provedores e estados de processamento de webhook
 */
export type WebhookProvider = 'misticpay' | 'didit';
export type WebhookProcessingStatus = 
  | 'received' 
  | 'processing' 
  | 'processed' 
  | 'duplicate' 
  | 'rejected' 
  | 'failed'
  | 'security_conflict';

export interface WebhookEventRecord {
  provider: WebhookProvider;
  eventId: string;
  eventType: string;
  payloadHash: string;
  status: WebhookProcessingStatus;
  entityId?: string | null;
  tenantId?: string | null;
  userId?: string | null;
  receivedAt: any;
  processedAt?: any;
  lastAttemptAt?: any;
  failureReason?: string | null;
  retryCount: number;
}

/**
 * Máquinas de estado para os domínios atendidos por webhooks
 */
const DOMAIN_ALLOWED_TRANSITIONS: Record<'payment' | 'withdrawal' | 'kyc', Record<string, string[]>> = {
  payment: {
    pending: ['paid', 'cancelled', 'refunded', 'pending'],
    paid: ['refunded', 'chargeback'], // 'paid' NUNCA regride para 'pending'
    cancelled: [],
    refunded: [],
    chargeback: []
  },
  withdrawal: {
    created: ['reserved', 'cancelled', 'failed'],
    reserved: ['processing', 'failed', 'cancelled'],
    processing: ['completed', 'failed', 'unknown'],
    unknown: ['completed', 'failed'],
    completed: [], // Terminal
    failed: [],    // Terminal
    cancelled: []  // Terminal
  },
  kyc: {
    not_started: ['in_progress', 'review', 'approved', 'declined', 'abandoned', 'expired'],
    in_progress: ['review', 'approved', 'declined', 'abandoned', 'expired', 'in_progress'],
    review: ['approved', 'declined', 'in_progress', 'review'],
    approved: ['review'], // Só pode ir para review sob auditoria do provedor
    declined: ['in_progress'],
    abandoned: ['in_progress', 'not_started'],
    expired: ['in_progress', 'not_started']
  }
};

/**
 * Valida se uma transição de estado é permitida no domínio especificado.
 */
export function canTransitionState(
  domain: 'payment' | 'withdrawal' | 'kyc',
  currentStatus: string,
  nextStatus: string
): boolean {
  const normCurrent = currentStatus.toLowerCase().trim();
  const normNext = nextStatus.toLowerCase().trim();

  if (normCurrent === normNext) return true; // idempotência de mesmo estado

  const transitions = DOMAIN_ALLOWED_TRANSITIONS[domain];
  if (!transitions) return false;

  const allowed = transitions[normCurrent];
  if (!allowed) return false;

  return allowed.includes(normNext);
}

/**
 * Compara strings/hashes em tempo constante contra timing attacks.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Valida se o payload contém chaves que tentam poluição de protótipo (__proto__, constructor, prototype)
 */
export function hasPrototypePollution(obj: any): boolean {
  if (obj === null || typeof obj !== 'object') return false;

  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (hasPrototypePollution(obj[key])) return true;
    }
  }
  return false;
}

/**
 * Valida o tamanho e a integridade de um buffer bruto de webhook.
 * - Limita o tamanho (máx 256KB por padrão).
 * - Calcula hash SHA-256 para auditoria e detecção de conflitos.
 * - Verifica proteção contra prototype pollution.
 */
export function parseAndValidateWebhookPayload(
  rawBuffer: Buffer,
  maxSizeBytes = 256 * 1024
): { payload: any; payloadHash: string } {
  if (!Buffer.isBuffer(rawBuffer)) {
    throw new Error('Corpo da requisição de webhook inválido (esperado Buffer bruto).');
  }

  if (rawBuffer.length > maxSizeBytes) {
    const err: any = new Error(`Payload excede o tamanho máximo permitido de ${maxSizeBytes / 1024}KB.`);
    err.statusCode = 413;
    throw err;
  }

  const payloadHash = crypto.createHash('sha256').update(rawBuffer).digest('hex');
  const rawStr = rawBuffer.toString('utf8');

  let parsed: any;
  try {
    parsed = JSON.parse(rawStr, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        const err: any = new Error('Tentativa de prototype pollution detectada e bloqueada no payload.');
        err.statusCode = 400;
        throw err;
      }
      return value;
    });
  } catch (jsonErr: any) {
    if (rawStr.includes('=') && !rawStr.startsWith('{') && !rawStr.startsWith('[')) {
      const qs = require('querystring');
      parsed = qs.parse(rawStr);
    } else {
      const err: any = new Error(jsonErr.message || 'Formato JSON inválido no corpo do webhook.');
      err.statusCode = jsonErr.statusCode || 400;
      throw err;
    }
  }

  return { payload: parsed, payloadHash };
}

/**
 * Rate Limiter simples em memória por IP e Provedor (Token Bucket / Sliding Window)
 */
class WebhookRateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();

  isAllowed(key: string, limit = 60, windowMs = 60000): boolean {
    const now = Date.now();
    const entry = this.requests.get(key);

    if (!entry || now > entry.resetTime) {
      this.requests.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  // Limpeza periódica de chaves expiradas a cada 5 minutos
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

export const webhookRateLimiter = new WebhookRateLimiter();
const cleanupTimer = setInterval(() => webhookRateLimiter.cleanup(), 5 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

/**
 * Serviço de Idempotência e Auditoria Centralizado para Webhooks
 */
export class WebhookService {
  /**
   * Realiza o claim atômico e idempotente de um evento de webhook em Firestore.
   * Se o evento já foi processado com o mesmo payloadHash, retorna `alreadyProcessed: true`.
   * Se o mesmo eventId chegar com payloadHash diferente, sinaliza `securityConflict: true`.
   */
  static async claimEvent(
    db: FirebaseFirestore.Firestore,
    params: {
      provider: WebhookProvider;
      eventId: string;
      eventType: string;
      payloadHash: string;
      entityId?: string | null;
      tenantId?: string | null;
      userId?: string | null;
    }
  ): Promise<{
    canProcess: boolean;
    alreadyProcessed?: boolean;
    securityConflict?: boolean;
    inFlight?: boolean;
  }> {
    const { provider, eventId, eventType, payloadHash, entityId, tenantId, userId } = params;
    const docKey = `${provider}:${eventId}`;
    const eventRef = db.collection('webhookEvents').doc(docKey);

    return await db.runTransaction(async (t) => {
      const docSnap = await t.get(eventRef);

      if (docSnap.exists) {
        const data = docSnap.data() as WebhookEventRecord;

        // Conflito de segurança: mesmo eventId com payload diferente!
        if (data.payloadHash && data.payloadHash !== payloadHash) {
          console.error(
            `[WEBHOOK SECURITY] Conflito detectado para ${docKey}: mesmo eventId com payloadHash divergente!`
          );
          t.set(eventRef, {
            status: 'security_conflict',
            lastAttemptAt: FieldValue.serverTimestamp(),
            failureReason: 'Payload hash conflict for identical eventId'
          }, { merge: true });

          return { canProcess: false, securityConflict: true };
        }

        // Se já processado com sucesso: idempotência pura
        if (data.status === 'processed') {
          return { canProcess: false, alreadyProcessed: true };
        }

        // Se está em processamento concorrente há menos de 30 segundos
        if (data.status === 'processing') {
          const lastAttempt = data.lastAttemptAt?.toMillis ? data.lastAttemptAt.toMillis() : Date.now();
          if (Date.now() - lastAttempt < 30000) {
            return { canProcess: false, inFlight: true };
          }
        }
      }

      // Claim do evento
      t.set(eventRef, {
        provider,
        eventId,
        eventType,
        payloadHash,
        status: 'processing',
        entityId: entityId || null,
        tenantId: tenantId || null,
        userId: userId || null,
        receivedAt: docSnap.exists ? docSnap.data()?.receivedAt : FieldValue.serverTimestamp(),
        lastAttemptAt: FieldValue.serverTimestamp(),
        retryCount: FieldValue.increment(1)
      }, { merge: true });

      return { canProcess: true };
    });
  }

  /**
   * Finaliza o processamento do evento de webhook na coleção `webhookEvents`.
   */
  static async finalizeEvent(
    db: FirebaseFirestore.Firestore,
    params: {
      provider: WebhookProvider;
      eventId: string;
      status: 'processed' | 'rejected' | 'failed';
      failureReason?: string | null;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const { provider, eventId, status, failureReason, metadata } = params;
    const docKey = `${provider}:${eventId}`;
    const eventRef = db.collection('webhookEvents').doc(docKey);

    const updateData: any = {
      status,
      processedAt: FieldValue.serverTimestamp()
    };

    if (failureReason) {
      updateData.failureReason = failureReason;
    }
    if (metadata && typeof metadata === 'object') {
      for (const [k, v] of Object.entries(metadata)) {
        if (k !== 'rawBody' && k !== 'secret' && k !== 'password' && k !== 'token') {
          updateData[k] = v;
        }
      }
    }

    await eventRef.set(updateData, { merge: true });
  }
}
