import crypto from 'crypto';
import express from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { parseAndValidateWebhookPayload } from './server-webhook-service';

/**
 * Máquina de Estados Estrita do KYC (FrontMarket / Front MK)
 */
export type KycCanonicalStatus = 
  | 'not_started' 
  | 'in_progress' 
  | 'review' 
  | 'approved' 
  | 'declined' 
  | 'abandoned' 
  | 'expired';

export interface KycRecord {
  status: KycCanonicalStatus;
  provider: 'didit';
  currentSessionId: string | null;
  verifiedAt: FirebaseFirestore.Timestamp | null;
  declinedAt: FirebaseFirestore.Timestamp | null;
  lastEventAt: FirebaseFirestore.Timestamp | null;
  lastEventId: string | null;
  updatedAt: FirebaseFirestore.FieldValue;
  version: number;
}

export interface KycSessionRecord {
  sessionId: string;
  uid: string;
  provider: 'didit';
  status: KycCanonicalStatus;
  createdAt: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
  completedAt: FirebaseFirestore.FieldValue | null;
  lastEventId: string | null;
  eventVersion: number;
}

/**
 * Matriz de transições permitidas.
 * Estados terminais (approved, declined) NÃO podem regredir para estados transitórios (in_progress, not_started).
 */
const ALLOWED_TRANSITIONS: Record<KycCanonicalStatus, KycCanonicalStatus[]> = {
  not_started: ['in_progress', 'review', 'approved', 'declined', 'abandoned', 'expired'],
  in_progress: ['review', 'approved', 'declined', 'abandoned', 'expired', 'in_progress'],
  review: ['approved', 'declined', 'in_progress', 'review'],
  approved: ['review'], // Só pode ir para review se houver re-verificação explícita do provedor
  declined: ['in_progress'], // Usuário pode reiniciar uma nova verificação
  abandoned: ['in_progress', 'not_started'],
  expired: ['in_progress', 'not_started']
};

/**
 * Normaliza status recebidos da Didit ou legados para o enum canônico.
 */
export function normalizeKycStatus(rawStatus?: string | null): KycCanonicalStatus {
  if (!rawStatus) return 'not_started';
  const s = rawStatus.toLowerCase().trim();

  if (s === 'approved') {
    return 'approved';
  }
  if (s === 'declined' || s === 'rejected' || s === 'failed') {
    return 'declined';
  }
  if (s === 'in review' || s === 'review' || s === 'in_review' || s === 'pending_review') {
    return 'review';
  }
  if (s === 'in progress' || s === 'in_progress' || s === 'started' || s === 'waiting' || s === 'pending' || s === 'resubmitted') {
    return 'in_progress';
  }
  if (s === 'abandoned') {
    return 'abandoned';
  }
  if (s.includes('expired')) {
    return 'expired';
  }
  return 'in_progress';
}

/**
 * Retorna o status canônico de KYC a partir do documento do usuário.
 * A única autoridade canônica de KYC é user.kyc.status.
 */
export function getCanonicalKycStatus(userData: any): KycCanonicalStatus {
  if (!userData) return 'not_started';
  const raw = userData?.kyc?.status;
  if (typeof raw === 'string' && raw.trim()) {
    return normalizeKycStatus(raw);
  }
  return 'not_started';
}

/**
 * Validação rigorosa e canônica de aprovação de KYC para operações financeiras.
 * Retorna true ESTRITAMENTE quando user.kyc.status === "approved".
 * NENHUM campo alternativo (verified, kyc_status, etc.) é aceito como autorização financeira.
 */
export function isKycApproved(userData: any): boolean {
  return getCanonicalKycStatus(userData) === 'approved';
}

/**
 * Compara dois hashes em tempo constante.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a.toLowerCase(), 'utf8');
  const bufB = Buffer.from(b.toLowerCase(), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Ordena chaves de objetos para serialização canônica HMAC.
 */
export function canonicalizeJson(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalizeJson);
  return Object.keys(obj)
    .sort()
    .reduce((acc: any, key: string) => {
      acc[key] = canonicalizeJson(obj[key]);
      return acc;
    }, {});
}

/**
 * Gera hash seguro de CPF para verificação de unicidade sem expor o documento em texto claro.
 */
export function hashCpf(cpf: string): string {
  const clean = cpf.replace(/\D/g, '');
  return crypto.createHash('sha256').update(`didit_cpf_salt_${clean}`).digest('hex');
}

/**
 * Extrai número de documento de forma segura sem registrar PII no log.
 */
export function extractSanitizedDocumentNumber(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const doc = payload.decision?.features?.ocr?.document_number || 
              payload.decision?.id_verifications?.[0]?.features?.ocr?.document_number ||
              payload.document_number ||
              payload.tax_id ||
              payload.cpf;
  if (typeof doc === 'string' && doc.trim().length > 0) {
    return doc.replace(/\D/g, '');
  }
  return null;
}

/**
 * Extrai primeiro nome ou display name de forma minimizada.
 */
export function extractSanitizedDisplayName(payload: any): string | null {
  const firstName = payload.decision?.features?.ocr?.first_name || 
                    payload.decision?.id_verifications?.[0]?.features?.ocr?.first_name ||
                    payload.first_name;
  const lastName = payload.decision?.features?.ocr?.last_name || 
                   payload.decision?.id_verifications?.[0]?.features?.ocr?.last_name ||
                   payload.last_name;
  if (firstName) {
    return `${firstName} ${lastName || ''}`.trim();
  }
  return null;
}

export class KycService {
  /**
   * Inicia a sessão KYC para um usuário autenticado.
   * Regras:
   * - O UID vem exclusivamente do token autenticado.
   * - O vendor_data é gerado no backend atrelado ao UID.
   * - Não confia em nenhum parâmetro vindo do body que tente alterar UID ou vendor_data.
   * - Falha segura (FAIL-CLOSED) se DIDIT_API_KEY não estiver configurada.
   */
  static async startUserKyc(
    db: FirebaseFirestore.Firestore,
    uid: string,
    originUrl: string
  ): Promise<{ verification_url: string; session_id: string }> {
    const apiKey = process.env.DIDIT_API_KEY;
    if (!apiKey) {
      console.error('[KYC SERVICE] Erro de configuração: DIDIT_API_KEY ausente.');
      const err: any = new Error('O serviço de verificação de identidade está temporariamente indisponível.');
      err.code = 'KYC_NOT_CONFIGURED';
      err.statusCode = 503;
      throw err;
    }

    const workflowId = process.env.DIDIT_WORKFLOW_ID;
    if (!workflowId) {
      console.error('[KYC SERVICE] Erro de configuração: DIDIT_WORKFLOW_ID ausente.');
      const err: any = new Error('O serviço de verificação de identidade está temporariamente indisponível.');
      err.code = 'KYC_NOT_CONFIGURED';
      err.statusCode = 503;
      throw err;
    }

    // 1. Verifica se já existe uma sessão recente aberta e em progresso nos últimos 15 minutos (idempotência amigável)
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    const currentStatus = normalizeKycStatus(userData?.kyc?.status || userData?.kyc_status);
    if (currentStatus === 'approved') {
      const err: any = new Error('Sua conta já possui verificação de identidade aprovada.');
      err.code = 'KYC_ALREADY_APPROVED';
      err.statusCode = 400;
      throw err;
    }

    // 2. Criação da sessão na Didit v3 (Node.js backend canônico)
    // O callback oficial redireciona o usuário para a tela administrativa de verificação
    const callbackUrl = `${originUrl}/admin/verification`;
    
    // vendor_data é estritamente o UID autenticado pelo servidor
    const vendorData = uid;

    const requestBody = {
      workflow_id: workflowId,
      vendor_data: vendorData,
      callback: callbackUrl,
      callback_method: 'both'
    };

    let sessionResponse: Response;
    try {
      sessionResponse = await fetch('https://verification.didit.me/v3/session/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify(requestBody)
      });
    } catch (netErr: any) {
      console.error('[KYC SERVICE] Falha de rede ao contatar Didit v3:', netErr.message);
      const err: any = new Error('Falha de comunicação com o provedor de verificação.');
      err.code = 'KYC_PROVIDER_ERROR';
      err.statusCode = 502;
      throw err;
    }

    const resText = await sessionResponse.text();
    let sessionData: any;
    try {
      sessionData = JSON.parse(resText);
    } catch (parseErr) {
      console.error('[KYC SERVICE] Resposta não-JSON da Didit:', resText.slice(0, 150));
      const err: any = new Error('Resposta inválida do provedor de identidade.');
      err.code = 'KYC_PROVIDER_ERROR';
      err.statusCode = 502;
      throw err;
    }

    if (!sessionResponse.ok) {
      console.error(`[KYC SERVICE] Erro HTTP da Didit (${sessionResponse.status}):`, sessionData?.message || sessionData?.detail || 'Erro desconhecido');
      const err: any = new Error(sessionData?.message || sessionData?.detail || 'Não foi possível gerar a sessão de verificação.');
      err.code = 'KYC_SESSION_CREATE_FAILED';
      err.statusCode = sessionResponse.status >= 500 ? 502 : 400;
      throw err;
    }

    const verificationUrl = sessionData.url || sessionData.session_url;
    const sessionId = sessionData.session_id || sessionData.id;

    if (!verificationUrl || !sessionId) {
      console.error('[KYC SERVICE] Payload incompleto retornado pela Didit:', sessionData);
      const err: any = new Error('Dados de sessão incompletos retornados pelo provedor.');
      err.code = 'KYC_PROVIDER_ERROR';
      err.statusCode = 502;
      throw err;
    }

    // 3. Persistência atômica da relação UID ↔ sessionId no Firestore
    const batch = db.batch();

    // Registro na subcoleção privada kycSessions
    const sessionDocRef = userRef.collection('kycSessions').doc(sessionId);
    batch.set(sessionDocRef, {
      sessionId,
      uid,
      provider: 'didit',
      status: 'in_progress',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      completedAt: null,
      lastEventId: null,
      eventVersion: 1
    });

    // Atualização do registro do usuário
    batch.set(userRef, {
      kyc: {
        status: 'in_progress',
        provider: 'didit',
        currentSessionId: sessionId,
        updatedAt: FieldValue.serverTimestamp()
      },
      // Campos de compatibilidade para consultas existentes
      kyc_status: 'in_progress',
      kyc_session_id: sessionId,
      kyc_session_created_at: Date.now()
    }, { merge: true });

    await batch.commit();

    console.log(`[KYC SERVICE] Sessão KYC criada com sucesso para usuário: ${uid.slice(0, 6)}... (Sessão: ${sessionId.slice(0, 8)}...)`);

    return {
      verification_url: verificationUrl,
      session_id: sessionId
    };
  }

  /**
   * Consulta o status seguro de KYC de um usuário autenticado.
   * Não aceita session_id de outros usuários. Retorna somente os dados mínimos necessários.
   */
  static async getUserKycStatus(
    db: FirebaseFirestore.Firestore,
    uid: string
  ): Promise<{
    status: KycCanonicalStatus;
    provider: string;
    verifiedAt: string | null;
    canWithdraw: boolean;
    currentSessionId: string | null;
  }> {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return {
        status: 'not_started',
        provider: 'didit',
        verifiedAt: null,
        canWithdraw: false,
        currentSessionId: null
      };
    }

    const userData = userDoc.data();
    const status = getCanonicalKycStatus(userData);

    let verifiedAtStr: string | null = null;
    if (userData?.kyc?.verifiedAt) {
      verifiedAtStr = userData.kyc.verifiedAt.toDate ? userData.kyc.verifiedAt.toDate().toISOString() : userData.kyc.verifiedAt;
    } else if (userData?.kyc_approved_at) {
      verifiedAtStr = userData.kyc_approved_at.toDate ? userData.kyc_approved_at.toDate().toISOString() : userData.kyc_approved_at;
    }

    const canWithdraw = isKycApproved(userData);

    return {
      status,
      provider: 'didit',
      verifiedAt: verifiedAtStr,
      canWithdraw,
      currentSessionId: userData?.kyc?.currentSessionId || userData?.kyc_session_id || null
    };
  }

  /**
   * Processamento de Webhooks Didit v3 com Fail-Closed, HMAC, Idempotência e Transação Atômica.
   */
  static async handleWebhook(
    db: FirebaseFirestore.Firestore,
    rawBuffer: Buffer,
    headers: Record<string, string | string[] | undefined>
  ): Promise<{ success: boolean; eventId: string; message: string }> {
    const secret = process.env.DIDIT_WEBHOOK_SECRET;

    // REGRA CRÍTICA FAIL-CLOSED: se o segredo não estiver configurado, REJEITA!
    if (!secret) {
      console.error('[DIDIT WEBHOOK] Erro crítico: DIDIT_WEBHOOK_SECRET não configurado. Rejeitando requisição (fail-closed).');
      const err: any = new Error('DIDIT_WEBHOOK_SECRET is not configured on server.');
      err.statusCode = 500;
      err.code = 'WEBHOOK_SECRET_MISSING';
      throw err;
    }

    const rawStr = rawBuffer.toString('utf8');
    const tsHeader = (headers['x-timestamp'] || '') as string;
    const ts = Number(tsHeader);
    const nowEpoch = Math.floor(Date.now() / 1000);

    // 1. Validação de frescura de Timestamp (máximo 300 segundos = 5 min)
    if (!ts || isNaN(ts) || Math.abs(nowEpoch - ts) > 300) {
      console.warn(`[DIDIT WEBHOOK] Replay ou timestamp fora da janela. Now: ${nowEpoch}, Header: ${tsHeader}`);
      const err: any = new Error('Timestamp do webhook expirado ou fora da janela de tolerância de 5 minutos.');
      err.statusCode = 401;
      err.code = 'KYC_WEBHOOK_STALE_TIMESTAMP';
      throw err;
    }

    // 2. Parse seguro do Payload com limitação de tamanho (256KB) e proteção contra prototype pollution
    let payload: any;
    let payloadHash: string;
    try {
      const parsedRes = parseAndValidateWebhookPayload(rawBuffer, 256 * 1024);
      payload = parsedRes.payload;
      payloadHash = parsedRes.payloadHash;
    } catch (jsonErr: any) {
      console.error('[DIDIT WEBHOOK] Payload inválido ou malformado:', jsonErr.message);
      const err: any = new Error(jsonErr.message || 'Payload JSON inválido.');
      err.statusCode = jsonErr.statusCode || 400;
      err.code = 'KYC_WEBHOOK_MALFORMED_JSON';
      throw err;
    }

    // 3. Validação de Assinatura HMAC-SHA256 em tempo constante
    const sigV2 = (headers['x-signature-v2'] || '') as string;
    const sigRaw = (headers['x-signature'] || '') as string;
    const sigSimple = (headers['x-signature-simple'] || '') as string;

    let isVerified = false;
    let authMethod = '';

    if (sigV2) {
      const canonicalJson = JSON.stringify(canonicalizeJson(payload));
      const expectedV2 = crypto.createHmac('sha256', secret).update(canonicalJson, 'utf8').digest('hex');
      if (timingSafeCompare(expectedV2, sigV2)) {
        isVerified = true;
        authMethod = 'x-signature-v2';
      }
    }

    if (!isVerified && sigRaw) {
      const expectedRaw = crypto.createHmac('sha256', secret).update(rawBuffer).digest('hex');
      if (timingSafeCompare(expectedRaw, sigRaw)) {
        isVerified = true;
        authMethod = 'x-signature';
      }
    }

    if (!isVerified && sigSimple) {
      const sessionIdVal = payload.session_id || payload.id || '';
      const statusVal = payload.status || '';
      const webhookTypeVal = payload.webhook_type || '';
      const simpleMsg = `${ts}:${sessionIdVal}:${statusVal}:${webhookTypeVal}`;
      const expectedSimple = crypto.createHmac('sha256', secret).update(simpleMsg, 'utf8').digest('hex');
      if (timingSafeCompare(expectedSimple, sigSimple)) {
        isVerified = true;
        authMethod = 'x-signature-simple';
      }
    }

    if (!isVerified) {
      console.error('[DIDIT WEBHOOK] Falha na validação da assinatura HMAC. Headers presentes:', {
        sigV2: !!sigV2,
        sigRaw: !!sigRaw,
        sigSimple: !!sigSimple,
        ts: tsHeader
      });
      const err: any = new Error('Assinatura HMAC do webhook inválida.');
      err.statusCode = 401;
      err.code = 'KYC_WEBHOOK_INVALID_SIGNATURE';
      throw err;
    }

    // 4. Identificação determinística de EventId e Idempotência
    const sessionId = payload.session_id || payload.id || null;
    const rawStatus = payload.status || '';
    const webhookType = (payload.webhook_type || 'status.updated').toLowerCase();
    const vendorData = payload.vendor_data || payload.metadata?.userId || null;

    const eventId = payload.event_id || 
      crypto.createHash('sha256').update(`${sessionId}_${rawStatus}_${webhookType}_${ts}`).digest('hex');

    // 5. Execução em Transação do Firestore (Atomicidade & Idempotência Garantidas)
    const eventDocRef = db.collection('kyc_webhook_events').doc(eventId);

    const transactionResult = await db.runTransaction(async (t) => {
      // 5.1 Checagem de idempotência
      const eventSnap = await t.get(eventDocRef);
      if (eventSnap.exists) {
        console.log(`[DIDIT WEBHOOK] Evento duplicado já processado (Idempotência): ${eventId}`);
        return { alreadyProcessed: true, eventId };
      }

      // 5.2 Validação de propriedade e vínculo Session ↔ UID
      if (!sessionId) {
        console.warn(`[DIDIT WEBHOOK] Evento sem session_id ignorado.`);
        t.set(eventDocRef, {
          eventId,
          status: 'ignored_missing_session_id',
          receivedAt: FieldValue.serverTimestamp()
        });
        return { alreadyProcessed: false, eventId, ignored: true };
      }

      // Procura a sessão registrada
      let targetUid: string | null = null;

      // Se tiver vendor_data, valida se a sessão existe na subcoleção do usuário
      if (vendorData) {
        const directSessionSnap = await t.get(
          db.collection('users').doc(vendorData).collection('kycSessions').doc(sessionId)
        );
        if (directSessionSnap.exists) {
          targetUid = vendorData;
        }
      }

      // Se não encontrou diretamente, busca na coleção global de usuários onde kyc_session_id ou kyc.currentSessionId == sessionId
      if (!targetUid) {
        const userQuery = await db.collection('users')
          .where('kyc_session_id', '==', sessionId)
          .limit(1)
          .get();

        if (!userQuery.empty) {
          targetUid = userQuery.docs[0].id;
        }
      }

      // Validação de conflito: se o webhook disser vendor_data = "X" mas a sessão pertence a "Y", REJEITA!
      if (vendorData && targetUid && vendorData !== targetUid) {
        console.error(`[DIDIT WEBHOOK] CONFLITO DE IDENTIDADE DETECTADO: vendor_data (${vendorData}) diferente do dono da sessão (${targetUid})!`);
        t.set(eventDocRef, {
          eventId,
          sessionId,
          status: 'security_conflict',
          receivedAt: FieldValue.serverTimestamp()
        });
        return { alreadyProcessed: false, eventId, securityConflict: true };
      }

      if (!targetUid) {
        console.warn(`[DIDIT WEBHOOK] Sessão ${sessionId} não encontrada no banco. Evento registrado como órfão.`);
        t.set(eventDocRef, {
          eventId,
          sessionId,
          status: 'unlinked_session',
          receivedAt: FieldValue.serverTimestamp()
        });
        return { alreadyProcessed: false, eventId, unlinked: true };
      }

      // 5.3 Carrega estado atual do usuário e valida máquina de estados
      const userRef = db.collection('users').doc(targetUid);
      const userDoc = await t.get(userRef);
      const userData = userDoc.data();

      const currentStatus = normalizeKycStatus(userData?.kyc?.status || userData?.kyc_status);
      const newStatus = normalizeKycStatus(rawStatus);

      // Proteção contra regressão de status final (APPROVED ou DECLINED não regridem para IN_PROGRESS por eventos atrasados)
      if (currentStatus === 'approved' && newStatus !== 'approved' && newStatus !== 'review') {
        console.log(`[DIDIT WEBHOOK] Regressão bloqueada: usuário já aprovado não regride para ${newStatus} (evento: ${eventId})`);
        t.set(eventDocRef, {
          eventId,
          sessionId,
          uid: targetUid,
          status: 'ignored_state_regression',
          receivedAt: FieldValue.serverTimestamp()
        });
        return { alreadyProcessed: false, eventId, regressionBlocked: true };
      }

      // 5.4 Checagem de unicidade de CPF (se for aprovação)
      const docNumber = extractSanitizedDocumentNumber(payload);
      let isDuplicateCpf = false;

      if (newStatus === 'approved' && docNumber) {
        const cpfHash = hashCpf(docNumber);
        const dupQuery = await db.collection('users')
          .where('kyc_cpf_hash', '==', cpfHash)
          .get();

        const otherApprovedUsers = dupQuery.docs.filter(
          d => d.id !== targetUid && (normalizeKycStatus(d.data().kyc_status) === 'approved' || d.data().verified === true)
        );

        if (otherApprovedUsers.length > 0) {
          console.warn(`[DIDIT WEBHOOK] Duplicidade de CPF bloqueada para usuário ${targetUid}`);
          isDuplicateCpf = true;
        }
      }

      // 5.5 Aplica a atualização de status
      const sessionDocRef = userRef.collection('kycSessions').doc(sessionId);
      const displayName = extractSanitizedDisplayName(payload);

      if (isDuplicateCpf) {
        // Recusa por duplicidade
        t.set(userRef, {
          kyc: {
            status: 'declined',
            provider: 'didit',
            currentSessionId: sessionId,
            declinedAt: FieldValue.serverTimestamp(),
            lastEventId: eventId,
            updatedAt: FieldValue.serverTimestamp()
          },
          kyc_status: 'declined',
          kyc_error: 'Este documento já está vinculado a outra conta verificada.',
          verified: false,
          verification_status: 'declined',
          kyc_last_event_id: eventId
        }, { merge: true });

        t.set(sessionDocRef, {
          status: 'declined',
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastEventId: eventId
        }, { merge: true });

      } else {
        const isApproved = newStatus === 'approved';
        const docHash = docNumber ? hashCpf(docNumber) : null;

        const kycUpdate: any = {
          status: newStatus,
          provider: 'didit',
          currentSessionId: sessionId,
          lastEventId: eventId,
          updatedAt: FieldValue.serverTimestamp()
        };

        if (isApproved) {
          kycUpdate.verifiedAt = FieldValue.serverTimestamp();
        } else if (newStatus === 'declined') {
          kycUpdate.declinedAt = FieldValue.serverTimestamp();
        }

        const userUpdatePayload: any = {
          kyc: kycUpdate,
          kyc_status: newStatus,
          kyc_session_id: sessionId,
          verified: isApproved,
          verification_status: newStatus,
          kyc_last_event_id: eventId,
          kyc_error: newStatus === 'declined' ? (payload.decision?.error || 'Documentação não aprovada.') : null
        };

        if (docHash) {
          userUpdatePayload.kyc_cpf_hash = docHash;
        }
        if (displayName) {
          userUpdatePayload.verified_name = displayName;
        }

        t.set(userRef, userUpdatePayload, { merge: true });

        t.set(sessionDocRef, {
          status: newStatus,
          updatedAt: FieldValue.serverTimestamp(),
          lastEventId: eventId,
          ...(isApproved || newStatus === 'declined' ? { completedAt: FieldValue.serverTimestamp() } : {})
        }, { merge: true });
      }

      // 5.6 Registra o evento processado (Minimização de PII: sem imagens, selfies ou dados integrais)
      t.set(eventDocRef, {
        eventId,
        sessionId,
        uid: targetUid,
        status: newStatus,
        webhookType,
        authMethod,
        processedAt: FieldValue.serverTimestamp(),
        receivedAt: FieldValue.serverTimestamp()
      });

      // Sincroniza com a coleção unificada webhookEvents/didit:{eventId}
      const unifiedEventRef = db.collection('webhookEvents').doc(`didit:${eventId}`);
      t.set(unifiedEventRef, {
        provider: 'didit',
        eventId,
        eventType: webhookType,
        payloadHash: payloadHash || null,
        status: 'processed',
        entityId: sessionId,
        userId: targetUid,
        processedAt: FieldValue.serverTimestamp(),
        receivedAt: FieldValue.serverTimestamp(),
        retryCount: 1
      }, { merge: true });

      return { alreadyProcessed: false, eventId, updatedStatus: newStatus };
    });

    console.log(`[DIDIT WEBHOOK] Evento ${eventId} processado via transação. Método de Auth: ${authMethod}.`);
    return {
      success: true,
      eventId,
      message: 'Evento processado com sucesso.'
    };
  }
}
