import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { isKycApproved } from './server-kyc-service';

export interface WalletDocument {
  pendingBalanceCents: number;
  availableBalanceCents: number;
  reservedBalanceCents: number;
  totalReceivedCents: number;
  totalWithdrawnCents: number;
  currency: 'BRL';
  version: number;
  createdAt: any;
  updatedAt: any;
}

export interface PaymentReleaseDocument {
  id: string;
  storeId: string;
  orderId: string;
  amountCents: number;
  feeCents: number;
  netAmountCents: number;
  currency: 'BRL';
  paymentMethod: string;
  status: 'pending' | 'released' | 'blocked' | 'cancelled';
  confirmedAt: any;
  releaseAt: any;
  releasedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export type LedgerEntryType =
  | 'PAYMENT_PENDING'
  | 'PAYMENT_RELEASED'
  | 'WITHDRAWAL_RESERVED'
  | 'WITHDRAWAL_COMPLETED'
  | 'WITHDRAWAL_FAILED'
  | 'WITHDRAWAL_RELEASED'
  | 'WALLET_INITIALIZED';

export interface WalletLedgerEntry {
  id: string;
  storeId: string;
  type: LedgerEntryType;
  amountCents: number;
  feeCents: number;
  netAmountCents: number;
  currency: 'BRL';
  balanceBucket: 'pending' | 'available' | 'reserved';
  referenceType: 'order' | 'withdrawal' | 'wallet_init' | 'adjustment';
  referenceId: string;
  idempotencyKey: string;
  metadata?: Record<string, any>;
  createdAt: any;
}

export interface WithdrawalParams {
  storeId: string;
  uid: string;
  amountCents: number;
  pixKey: string;
  pixKeyType: string;
  idempotencyKey: string;
  gateway?: string;
  requestId?: string; requestHost?: string;
}

export interface WithdrawalResult {
  success: boolean;
  code?: string;
  message: string;
  withdrawalId?: string;
  misticTransactionId?: string | number;
  requestId?: string; requestHost?: string;
  details?: any;
}

export class FinancialError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'FinancialError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function validatePixKey(key: string, type: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const clean = key.trim();

  switch (type?.toUpperCase()) {
    case 'CPF': {
      const digits = clean.replace(/\D/g, '');
      return digits.length === 11;
    }
    case 'CNPJ': {
      const digits = clean.replace(/\D/g, '');
      return digits.length === 14;
    }
    case 'EMAIL': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(clean) && clean.length <= 100;
    }
    case 'TELEFONE': {
      const phoneDigits = clean.replace(/\D/g, '');
      return phoneDigits.length >= 10 && phoneDigits.length <= 15;
    }
    case 'CHAVE_ALEATORIA': {
      return clean.length >= 10 && clean.length <= 128;
    }
    default:
      return false;
  }
}

export function sanitizePixKey(key: string, type: string): string {
  const clean = key.trim();
  const upperType = type?.toUpperCase();
  if (upperType === 'CPF' || upperType === 'CNPJ') {
    return clean.replace(/\D/g, '');
  }
  if (upperType === 'TELEFONE') {
    return clean.replace(/[^\d+]/g, '');
  }
  return clean;
}

export function maskPixKey(key: string, type: string): string {
  if (!key) return '';
  const clean = key.trim();
  const upperType = type?.toUpperCase();
  if (upperType === 'CPF') {
    const d = clean.replace(/\D/g, '');
    if (d.length >= 11) return `${d.slice(0, 3)}.***.***-${d.slice(-2)}`;
  }
  if (upperType === 'CNPJ') {
    const d = clean.replace(/\D/g, '');
    if (d.length >= 14) return `${d.slice(0, 2)}.***.***/****-${d.slice(-2)}`;
  }
  if (upperType === 'EMAIL') {
    const parts = clean.split('@');
    if (parts.length === 2) {
      const user = parts[0];
      const domain = parts[1];
      const maskedUser = user.length <= 2 ? `${user[0]}*` : `${user.slice(0, 2)}***${user.slice(-1)}`;
      return `${maskedUser}@${domain}`;
    }
  }
  if (upperType === 'TELEFONE') {
    const d = clean.replace(/\D/g, '');
    if (d.length >= 10) return `(${d.slice(0, 2)}) *****-${d.slice(-4)}`;
  }
  if (clean.length > 8) {
    return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
  }
  return '***';
}

export class FinancialWalletService {
  public static readonly WITHDRAW_FEE_CENTS = 1000; // R$ 10,00 fixos
  public static readonly MIN_WITHDRAW_CENTS = 2000; // R$ 20,00 mínimo
  public static readonly D3_DURATION_MS = 72 * 60 * 60 * 1000; // 72 horas completas = 259.200.000 ms

  /**
   * Obtém a Wallet da loja ou inicializa de forma atômica e idempotente.
   * Não altera nem apaga dados anteriores.
   */
  static async getOrCreateWallet(db: any, storeId: string, transaction?: any): Promise<WalletDocument> {
    const storeRef = db.collection('stores').doc(storeId);
    const walletRef = storeRef.collection('wallet').doc('main');

    const readDoc = async (t?: any) => {
      return t ? await t.get(walletRef) : await walletRef.get();
    };

    const writeDoc = async (data: any, t?: any) => {
      if (t) {
        t.set(walletRef, data);
      } else {
        await walletRef.set(data);
      }
    };

    const snap = await readDoc(transaction);

    if (snap.exists) {
      const data = snap.data() as WalletDocument;
      return {
        pendingBalanceCents: Number(data.pendingBalanceCents) || 0,
        availableBalanceCents: Number(data.availableBalanceCents) || 0,
        reservedBalanceCents: Number(data.reservedBalanceCents) || 0,
        totalReceivedCents: Number(data.totalReceivedCents) || 0,
        totalWithdrawnCents: Number(data.totalWithdrawnCents) || 0,
        currency: 'BRL',
        version: Number(data.version) || 1,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    }

    // Inicialização da carteira
    // Se a loja já tiver dados legados na base, inicializamos os saldos sem alterá-los
    let initialPending = 0;
    let initialAvailable = 0;
    let initialWithdrawn = 0;

    try {
      const ordersSnap = await storeRef.collection('orders').where('status', '==', 'paid').get();
      const now = Date.now();
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

      ordersSnap.forEach((doc: any) => {
        const o = doc.data();
        const valueCents = Math.round((Number(o.total) || 0) * 100);
        const method = o.paymentMethod || 'pix';
        let feeCents = Math.round(valueCents * 0.07);
        if (method === 'credit_card' || method === 'debit_card') feeCents = Math.round(valueCents * 0.13);
        else if (method === 'boleto') feeCents = Math.round(valueCents * 0.09);

        const netCents = Math.max(0, valueCents - feeCents);
        let paidAtTime = now;
        if (o.paidAt) {
          paidAtTime = typeof o.paidAt.toDate === 'function' ? o.paidAt.toDate().getTime() : new Date(o.paidAt).getTime();
        } else if (o.createdAt) {
          paidAtTime = typeof o.createdAt.toDate === 'function' ? o.createdAt.toDate().getTime() : new Date(o.createdAt).getTime();
        }

        if (now - paidAtTime >= THREE_DAYS_MS) {
          initialAvailable += netCents;
        } else {
          initialPending += netCents;
        }
      });

      const withdrawalsSnap = await storeRef.collection('withdrawals').get();
      withdrawalsSnap.forEach((doc: any) => {
        const w = doc.data();
        if (w.status === 'pending' || w.status === 'processing' || w.status === 'completed') {
          const wAmountCents = Number(w.amountCents) || Math.round((Number(w.amount) || 0) * 100);
          const wFeeCents = Number(w.feeCents) || FinancialWalletService.WITHDRAW_FEE_CENTS;
          initialWithdrawn += (wAmountCents + wFeeCents);
        }
      });
    } catch (migErr) {
      console.warn(`[FinancialWalletService] Aviso ao computar snapshot inicial da loja ${storeId}:`, migErr);
    }

    const availableBalanceCents = Math.max(0, initialAvailable - initialWithdrawn);
    const totalReceivedCents = initialAvailable + initialPending;

    const newWallet: WalletDocument = {
      pendingBalanceCents: initialPending,
      availableBalanceCents,
      reservedBalanceCents: 0,
      totalReceivedCents,
      totalWithdrawnCents: initialWithdrawn,
      currency: 'BRL',
      version: 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    await writeDoc(newWallet, transaction);

    // Registro inicial no Ledger
    const ledgerRef = storeRef.collection('walletLedger').doc();
    const ledgerData: WalletLedgerEntry = {
      id: ledgerRef.id,
      storeId,
      type: 'WALLET_INITIALIZED',
      amountCents: totalReceivedCents,
      feeCents: 0,
      netAmountCents: totalReceivedCents,
      currency: 'BRL',
      balanceBucket: 'available',
      referenceType: 'wallet_init',
      referenceId: 'main',
      idempotencyKey: `init-${storeId}`,
      metadata: {
        migratedOrders: true
      },
      createdAt: FieldValue.serverTimestamp()
    };

    if (transaction) {
      transaction.set(ledgerRef, ledgerData);
    } else {
      await ledgerRef.set(ledgerData);
    }

    return newWallet;
  }

  /**
   * Credita um pagamento confirmado (ordem paga) atomicamente no ledger, paymentReleases e na carteira.
   * O valor líquido entra estritamente em pendingBalanceCents e gera um PaymentRelease agendado para D+3 (72h completas).
   */
  static async creditPayment(
    db: any,
    params: {
      storeId: string;
      orderId: string;
      amountCents: number;
      feeCents?: number;
      paymentMethod?: string;
      idempotencyKey?: string;
      requestId?: string; requestHost?: string;
      confirmedAtMillis?: number;
    }
  ): Promise<{ success: boolean; netAmountCents: number; alreadyProcessed?: boolean; releaseAt?: string }> {
    const { storeId, orderId, amountCents, feeCents = 0, paymentMethod = 'pix', requestId } = params;
    const iKey = params.idempotencyKey || `order-paid-${orderId}`;

    const storeRef = db.collection('stores').doc(storeId);
    const walletRef = storeRef.collection('wallet').doc('main');
    const ledgerRef = storeRef.collection('walletLedger');
    const releaseRef = storeRef.collection('paymentReleases').doc(orderId);

    const nowMs = params.confirmedAtMillis || Date.now();
    const confirmedAtTs = Timestamp.fromMillis(nowMs);
    const releaseAtTs = Timestamp.fromMillis(nowMs + FinancialWalletService.D3_DURATION_MS);

    return await db.runTransaction(async (t: any) => {
      // 1. Verificação de Idempotência no Documento de Release
      const existingReleaseSnap = await t.get(releaseRef);
      if (existingReleaseSnap.exists) {
        const existingData = existingReleaseSnap.data();
        return {
          success: true,
          netAmountCents: Number(existingData.netAmountCents) || (amountCents - feeCents),
          alreadyProcessed: true,
          releaseAt: existingData.releaseAt?.toDate ? existingData.releaseAt.toDate().toISOString() : existingData.releaseAt
        };
      }

      // 2. Verificação de Idempotência no Ledger
      const existingQuery = await t.get(
        ledgerRef.where('referenceId', '==', orderId).where('type', '==', 'PAYMENT_PENDING').limit(1)
      );

      if (!existingQuery.empty) {
        return {
          success: true,
          netAmountCents: Math.max(0, amountCents - feeCents),
          alreadyProcessed: true
        };
      }

      // 3. Leitura da Wallet
      const walletSnap = await t.get(walletRef);
      let wallet: WalletDocument;

      if (!walletSnap.exists) {
        wallet = await FinancialWalletService.getOrCreateWallet(db, storeId, t);
      } else {
        wallet = walletSnap.data() as WalletDocument;
      }

      const netAmountCents = Math.max(0, amountCents - feeCents);

      // Invariantes financeiras: saldo nunca negativo
      const nextPending = (Number(wallet.pendingBalanceCents) || 0) + netAmountCents;
      const nextTotalReceived = (Number(wallet.totalReceivedCents) || 0) + netAmountCents;
      const nextVersion = (Number(wallet.version) || 1) + 1;

      // 4. Criação do agendamento persistente de release D+3 (72h completas)
      const releaseDocData: PaymentReleaseDocument = {
        id: orderId,
        storeId,
        orderId,
        amountCents,
        feeCents,
        netAmountCents,
        currency: 'BRL',
        paymentMethod,
        status: 'pending',
        confirmedAt: confirmedAtTs,
        releaseAt: releaseAtTs,
        releasedAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      t.set(releaseRef, releaseDocData);

      // 5. Atualização atômica da Wallet (apenas pendingBalanceCents é incrementado)
      t.set(
        walletRef,
        {
          pendingBalanceCents: nextPending,
          totalReceivedCents: nextTotalReceived,
          version: nextVersion,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      // 6. Criação imutável do lançamento no Ledger (bucket: pending)
      const newLedgerDoc = ledgerRef.doc();
      const ledgerEntry: WalletLedgerEntry = {
        id: newLedgerDoc.id,
        storeId,
        type: 'PAYMENT_PENDING',
        amountCents,
        feeCents,
        netAmountCents,
        currency: 'BRL',
        balanceBucket: 'pending',
        referenceType: 'order',
        referenceId: orderId,
        idempotencyKey: iKey,
        metadata: {
          paymentMethod,
          releaseAt: releaseAtTs,
          requestId: requestId || null
        },
        createdAt: FieldValue.serverTimestamp()
      };

      t.set(newLedgerDoc, ledgerEntry);

      return {
        success: true,
        netAmountCents,
        releaseAt: releaseAtTs.toDate().toISOString()
      };
    });

    if (result && result.success) {
      import('./server-notification-service.js').then(({ processEvent }) => {
        processEvent({
          eventId: `D3_CREATED_${storeId}_${orderId}`,
          type: 'D3_RELEASE_CREATED' as any, // D3_RELEASE_CREATED equivalent?
          storeId,
          orderId,
          source: 'system',
          occurredAt: new Date().toISOString()
        }).catch(console.error);
      });
    }

    return result;
  }

  /**
   * Libera um pagamento pendente cujo prazo de 72h completas (D+3) foi atingido.
   * Transfere atômica e idempotentemente o valor de pendingBalanceCents para availableBalanceCents.
   */
  static async releasePayment(
    db: any,
    params: {
      storeId: string;
      orderId: string;
      idempotencyKey?: string;
      nowMillis?: number;
    }
  ): Promise<{
    success: boolean;
    alreadyReleased?: boolean;
    notEligible?: boolean;
    reason?: string;
    netAmountCents?: number;
  }> {
    const { storeId, orderId } = params;
    const storeRef = db.collection('stores').doc(storeId);
    const releaseRef = storeRef.collection('paymentReleases').doc(orderId);
    const walletRef = storeRef.collection('wallet').doc('main');
    const ledgerRef = storeRef.collection('walletLedger');

    const deterministicKey = params.idempotencyKey || `PAYMENT_RELEASED:${storeId}:${orderId}`;

    return await db.runTransaction(async (t: any) => {
      // 1. Leitura do documento de release
      const releaseSnap = await t.get(releaseRef);
      if (!releaseSnap.exists) {
        return { success: false, notEligible: true, reason: 'Release document not found' };
      }

      const releaseData = releaseSnap.data() as PaymentReleaseDocument;

      // Se já foi liberado, não executa novamente (idempotência estrita)
      if (releaseData.status === 'released') {
        return { success: true, alreadyReleased: true, netAmountCents: releaseData.netAmountCents };
      }

      if (releaseData.status !== 'pending') {
        return { success: false, notEligible: true, reason: `Status is ${releaseData.status}` };
      }

      // 2. Verificação estrita de tempo: 72 horas completas
      const releaseAtMs = releaseData.releaseAt?.toMillis
        ? releaseData.releaseAt.toMillis()
        : (releaseData.releaseAt instanceof Date ? releaseData.releaseAt.getTime() : new Date(releaseData.releaseAt).getTime());

      const checkTimeMs = params.nowMillis || Date.now();
      if (checkTimeMs < releaseAtMs) {
        return {
          success: false,
          notEligible: true,
          reason: `Still in lock period (releases at ${new Date(releaseAtMs).toISOString()})`
        };
      }

      const netAmountCents = Number(releaseData.netAmountCents) || 0;
      if (netAmountCents <= 0) {
        t.update(releaseRef, {
          status: 'released',
          releasedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true, netAmountCents: 0 };
      }

      // 3. Leitura da Wallet
      const walletSnap = await t.get(walletRef);
      let wallet: WalletDocument;
      if (!walletSnap.exists) {
        wallet = await FinancialWalletService.getOrCreateWallet(db, storeId, t);
      } else {
        wallet = walletSnap.data() as WalletDocument;
      }

      const curPending = Number(wallet.pendingBalanceCents) || 0;
      const curAvailable = Number(wallet.availableBalanceCents) || 0;

      if (curPending < netAmountCents) {
        throw new Error('Invariante violada: saldo pendente insuficiente para cobrir o release. Corrupção financeira detectada.');
      }

      // Invariantes matemáticas:
      // pending diminui exatamente netAmountCents
      // available aumenta exatamente netAmountCents
      const nextPending = curPending - netAmountCents;
      const nextAvailable = curAvailable + netAmountCents;
      const nextVersion = (Number(wallet.version) || 1) + 1;

      // 4. Atualização da Wallet
      t.set(
        walletRef,
        {
          pendingBalanceCents: nextPending,
          availableBalanceCents: nextAvailable,
          version: nextVersion,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      // 5. Atualização do PaymentRelease para 'released'
      t.update(releaseRef, {
        status: 'released',
        releasedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      // 6. Lançamento atômico e imutável no Ledger
      const newLedgerDoc = ledgerRef.doc();
      const ledgerEntry: WalletLedgerEntry = {
        id: newLedgerDoc.id,
        storeId,
        type: 'PAYMENT_RELEASED',
        amountCents: Number(releaseData.amountCents) || netAmountCents,
        feeCents: Number(releaseData.feeCents) || 0,
        netAmountCents,
        currency: 'BRL',
        balanceBucket: 'available',
        referenceType: 'order',
        referenceId: orderId,
        idempotencyKey: deterministicKey,
        metadata: {
          originalConfirmedAt: releaseData.confirmedAt,
          releaseAt: releaseData.releaseAt,
          paymentMethod: releaseData.paymentMethod || 'pix'
        },
        createdAt: FieldValue.serverTimestamp()
      };

      t.set(newLedgerDoc, ledgerEntry);

      return { success: true, netAmountCents };
    });
  }

  /**
   * Rotina global de processamento de liberações D+3 elegíveis.
   * Procura pagamentos com status 'pending' e releaseAt <= agora confiável.
   */
  static async processEligibleReleases(
    db: any,
    options?: { limit?: number; nowMillis?: number }
  ): Promise<{
    totalFound: number;
    releasedCount: number;
    alreadyReleasedCount: number;
    errorCount: number;
    durationMs: number;
  }> {
    const startTime = Date.now();
    const checkTime = options?.nowMillis || startTime;
    const nowTimestamp = Timestamp.fromMillis(checkTime);
    const queryLimit = options?.limit || 100;

    let totalFound = 0;
    let releasedCount = 0;
    let alreadyReleasedCount = 0;
    let errorCount = 0;

    try {
      const snap = await db.collectionGroup('paymentReleases')
        .where('status', '==', 'pending')
        .where('releaseAt', '<=', nowTimestamp)
        .limit(queryLimit)
        .get();

      totalFound = snap.size;

      for (const doc of snap.docs) {
        const data = doc.data();
        try {
          const res = await FinancialWalletService.releasePayment(db, {
            storeId: data.storeId,
            orderId: data.orderId,
            nowMillis: checkTime
          });

          if (res.success) {
            if (res.alreadyReleased) {
              alreadyReleasedCount++;
            } else {
              releasedCount++;
            }
          }
        } catch (err: any) {
          errorCount++;
          console.error(`[D+3 Release Job] Erro ao liberar order ${data.orderId} da loja ${data.storeId}:`, err.message);
        }
      }
    } catch (queryErr: any) {
      console.error('[D+3 Release Job] Erro na consulta de releases elegíveis:', queryErr.message);
    }

    const durationMs = Date.now() - startTime;
    return {
      totalFound,
      releasedCount,
      alreadyReleasedCount,
      errorCount,
      durationMs
    };
  }

  /**
   * Backfill seguro e não-destrutivo para ordens existentes.
   * Cria os registros de paymentReleases correspondentes se ainda não existirem.
   */
  static async backfillPaymentReleases(db: any): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    const now = Date.now();

    try {
      const ordersSnap = await db.collectionGroup('orders').where('status', '==', 'paid').get();
      for (const oDoc of ordersSnap.docs) {
        const o = oDoc.data();
        const storeId = o.storeId;
        const orderId = oDoc.id;
        if (!storeId || !orderId) continue;

        const releaseRef = db.collection('stores').doc(storeId).collection('paymentReleases').doc(orderId);
        const releaseDoc = await releaseRef.get();

        if (releaseDoc.exists) {
          skipped++;
          continue;
        }

        const valueCents = Math.round((Number(o.total) || 0) * 100);
        const method = o.paymentMethod || 'pix';
        let feeCents = Math.round(valueCents * 0.07);
        if (method === 'credit_card' || method === 'debit_card') feeCents = Math.round(valueCents * 0.13);
        else if (method === 'boleto') feeCents = Math.round(valueCents * 0.09);
        const netCents = Math.max(0, valueCents - feeCents);

        let paidTimeMs = now;
        if (o.paidAt) {
          paidTimeMs = typeof o.paidAt.toDate === 'function' ? o.paidAt.toDate().getTime() : new Date(o.paidAt).getTime();
        } else if (o.createdAt) {
          paidTimeMs = typeof o.createdAt.toDate === 'function' ? o.createdAt.toDate().getTime() : new Date(o.createdAt).getTime();
        }

        const releaseTimeMs = paidTimeMs + FinancialWalletService.D3_DURATION_MS;
        const alreadyEligible = now >= releaseTimeMs;

        await releaseRef.set({
          id: orderId,
          storeId,
          orderId,
          amountCents: valueCents,
          feeCents,
          netAmountCents: netCents,
          currency: 'BRL',
          paymentMethod: method,
          status: alreadyEligible ? 'released' : 'pending',
          confirmedAt: Timestamp.fromMillis(paidTimeMs),
          releaseAt: Timestamp.fromMillis(releaseTimeMs),
          releasedAt: alreadyEligible ? Timestamp.fromMillis(releaseTimeMs) : null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        created++;
      }
    } catch (e: any) {
      console.warn('[FinancialWalletService] Aviso no backfill de paymentReleases:', e.message);
    }

    return { created, skipped };
  }

  /**
   * Reserva saldo para saque de forma estritamente atômica.
   * Deduz de availableBalanceCents e transfere para reservedBalanceCents.
   */
  static async reserveWithdrawal(
    db: any,
    params: WithdrawalParams
  ): Promise<{ withdrawal: any; wallet: WalletDocument }> {
    const { storeId, uid, amountCents, pixKey, pixKeyType, idempotencyKey, gateway = 'misticpay', requestId } = params;

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new FinancialError('INVALID_IDEMPOTENCY_KEY', 'Chave de idempotência ausente ou inválida (deve conter entre 8 e 128 caracteres).');
    }

    if (!amountCents || amountCents < FinancialWalletService.MIN_WITHDRAW_CENTS) {
      throw new FinancialError('INVALID_AMOUNT', 'Valor de saque inválido. O valor mínimo é de R$ 20,00.');
    }

    const validTypes = ['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'CHAVE_ALEATORIA'];
    const normalizedType = pixKeyType?.toUpperCase() || 'CPF';
    if (!validTypes.includes(normalizedType) || !validatePixKey(pixKey, normalizedType)) {
      throw new FinancialError('INVALID_PIX_KEY', `Formato de chave PIX inválido para o tipo ${normalizedType}.`);
    }

    const sanitizedKey = sanitizePixKey(pixKey, normalizedType);
    const feeCents = FinancialWalletService.WITHDRAW_FEE_CENTS;
    const totalNeededCents = amountCents + feeCents;

    const storeRef = db.collection('stores').doc(storeId);
    const walletRef = storeRef.collection('wallet').doc('main');
    const withdrawalsRef = storeRef.collection('withdrawals');
    const ledgerRef = storeRef.collection('walletLedger');

    return await db.runTransaction(async (t: any) => {
      // 1. Verificação de Autenticação e Propriedade da Loja
      const storeDoc = await t.get(storeRef);
      if (!storeDoc.exists) {
        throw new FinancialError('STORE_NOT_FOUND', 'Loja não encontrada.', 404);
      }
      if (storeDoc.data().ownerId !== uid) {
        throw new FinancialError('FORBIDDEN', 'Acesso negado. Apenas o proprietário pode solicitar saques.', 403);
      }

      // 1.1 Verificação de KYC no servidor com política FAIL-CLOSED (nunca confia no cliente)
      const userRef = db.collection('users').doc(uid);
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) {
        throw new FinancialError(
          'KYC_REQUIRED',
          'A verificação de identidade (KYC) precisa estar aprovada para solicitar saques.',
          403
        );
      }

      const userData = userDoc.data();
      const isApproved = isKycApproved(userData);

      if (!isApproved) {
        throw new FinancialError(
          'KYC_REQUIRED',
          'A verificação de identidade (KYC) precisa estar aprovada para solicitar saques.',
          403
        );
      }

      // 2. Verificação de Idempotência Estrita
      const existingQuery = await t.get(withdrawalsRef.where('idempotencyKey', '==', idempotencyKey).limit(1));
      if (!existingQuery.empty) {
        const existingDoc = existingQuery.docs[0];
        const existingData = existingDoc.data();
        const existingAmount = Number(existingData.amountCents) || Math.round((Number(existingData.amount) || 0) * 100);
        const isSameAmount = existingAmount === amountCents;
        const isSamePixKey = existingData.pixKey === sanitizedKey;
        const isSamePixType = existingData.pixKeyType === normalizedType;

        // Se a mesma chave foi enviada com parâmetros diferentes: CONFLITO
        if (!isSameAmount || !isSamePixKey || !isSamePixType) {
          throw new FinancialError(
            'IDEMPOTENCY_CONFLICT',
            'A chave de idempotência já foi utilizada com parâmetros de saque diferentes.',
            409
          );
        }

        // Se mesmos parâmetros, retorna a operação já existente sem cobrança nem reserva duplicada
        const walletSnap = await t.get(walletRef);
        let currentWallet: WalletDocument;
        if (!walletSnap.exists) {
          currentWallet = await FinancialWalletService.getOrCreateWallet(db, storeId, t);
        } else {
          currentWallet = walletSnap.data() as WalletDocument;
        }

        return {
          withdrawal: { id: existingDoc.id, ...existingData },
          wallet: currentWallet,
          isExisting: true
        };
      }

      // 3. Leitura e Verificação do Saldo na Wallet
      const walletSnap = await t.get(walletRef);
      let wallet: WalletDocument;
      if (!walletSnap.exists) {
        wallet = await FinancialWalletService.getOrCreateWallet(db, storeId, t);
      } else {
        const raw = walletSnap.data();
        wallet = {
          pendingBalanceCents: Number(raw.pendingBalanceCents) || 0,
          availableBalanceCents: Number(raw.availableBalanceCents) || 0,
          reservedBalanceCents: Number(raw.reservedBalanceCents) || 0,
          totalReceivedCents: Number(raw.totalReceivedCents) || 0,
          totalWithdrawnCents: Number(raw.totalWithdrawnCents) || 0,
          currency: 'BRL',
          version: Number(raw.version) || 1,
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt
        };
      }

      // 4. Invariante rigorosa: Saldo disponível deve cobrir valor + taxa
      if (wallet.availableBalanceCents < totalNeededCents) {
        const availableReais = (wallet.availableBalanceCents / 100).toFixed(2);
        throw new FinancialError(
          'INSUFFICIENT_BALANCE',
          `Saldo disponível insuficiente. Disponível: R$ ${availableReais}. Necessário: R$ ${(totalNeededCents / 100).toFixed(2)} (incluindo taxa de R$ 10,00).`,
          422
        );
      }

      const nextAvailable = wallet.availableBalanceCents - totalNeededCents;
      const nextReserved = wallet.reservedBalanceCents + totalNeededCents;

      // Invariante: Nunca permitir saldo negativo
      if (nextAvailable < 0) {
        throw new FinancialError('INSUFFICIENT_BALANCE', 'Saldo disponível insuficiente para cobrir o saque.', 422);
      }

      const nextVersion = wallet.version + 1;

      // 5. Atualização atômica da Wallet
      t.set(
        walletRef,
        {
          availableBalanceCents: nextAvailable,
          reservedBalanceCents: nextReserved,
          version: nextVersion,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      // 6. Criação do documento de Saque
      const newWithdrawalRef = withdrawalsRef.doc();
      const maskedKey = maskPixKey(sanitizedKey, normalizedType);
      const withdrawalData = {
        id: newWithdrawalRef.id,
        storeId,
        uid,
        amountCents,
        feeCents,
        totalDeductedCents: totalNeededCents,
        // Campos retrocompatíveis com interface em Reais
        amount: amountCents / 100,
        fee: feeCents / 100,
        totalDeducted: totalNeededCents / 100,
        status: 'reserved',
        pixKey: sanitizedKey,
        maskedPixKey: maskedKey,
        pixKeyType: normalizedType,
        gateway,
        idempotencyKey,
        requestId: requestId || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      t.set(newWithdrawalRef, withdrawalData);

      // 7. Registro imutável no Ledger
      const newLedgerDoc = ledgerRef.doc();
      const ledgerEntry: WalletLedgerEntry = {
        id: newLedgerDoc.id,
        storeId,
        type: 'WITHDRAWAL_RESERVED',
        amountCents,
        feeCents,
        netAmountCents: totalNeededCents,
        currency: 'BRL',
        balanceBucket: 'reserved',
        referenceType: 'withdrawal',
        referenceId: newWithdrawalRef.id,
        idempotencyKey: `ledger-res-${newWithdrawalRef.id}`,
        metadata: {
          pixKeyType: normalizedType,
          maskedPixKey: maskedKey,
          requestId: requestId || null
        },
        createdAt: FieldValue.serverTimestamp()
      };
      t.set(newLedgerDoc, ledgerEntry);

      return {
        withdrawal: withdrawalData,
        wallet: {
          ...wallet,
          availableBalanceCents: nextAvailable,
          reservedBalanceCents: nextReserved,
          version: nextVersion
        },
        isExisting: false
      };
    });
  }

  /**
   * Confirmação de saque após sucesso do gateway externo.
   * Transfere de reservedBalanceCents para totalWithdrawnCents.
   */
  static async confirmWithdrawal(
    db: any,
    params: { storeId: string; withdrawalId: string; misticTransactionId?: string | number; requestId?: string }
  ): Promise<void> {
    const { storeId, withdrawalId, misticTransactionId, requestId } = params;
    const storeRef = db.collection('stores').doc(storeId);
    const walletRef = storeRef.collection('wallet').doc('main');
    const withdrawalRef = storeRef.collection('withdrawals').doc(withdrawalId);
    const ledgerRef = storeRef.collection('walletLedger');

    await db.runTransaction(async (t: any) => {
      const wDoc = await t.get(withdrawalRef);
      if (!wDoc.exists) return;
      const wData = wDoc.data();

      // Se já finalizado ou com falha, idempotência estrita: não regride nem altera
      if (wData.status === 'completed' || wData.status === 'failed') return;

      const totalDeductedCents = Number(wData.totalDeductedCents) || Math.round((Number(wData.totalDeducted) || 0) * 100);

      const walletSnap = await t.get(walletRef);
      if (walletSnap.exists) {
        const w = walletSnap.data() as WalletDocument;
        const currentReserved = Number(w.reservedBalanceCents) || 0;
        if (currentReserved < totalDeductedCents) {
           throw new Error('Invariante violada: saldo reservado insuficiente para a operação.');
        }
        const nextReserved = currentReserved - totalDeductedCents;
        const nextTotalWithdrawn = (Number(w.totalWithdrawnCents) || 0) + totalDeductedCents;

        t.set(
          walletRef,
          {
            reservedBalanceCents: nextReserved,
            totalWithdrawnCents: nextTotalWithdrawn,
            version: (Number(w.version) || 1) + 1,
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }

      t.update(withdrawalRef, {
        status: 'completed',
        misticTransactionId: misticTransactionId || wData.misticTransactionId || null,
        updatedAt: FieldValue.serverTimestamp()
      });

      import('./server-notification-service.js').then(({ processEvent }) => {
        processEvent({
          eventId: `WITHDRAWAL_COMPLETED_${withdrawalId}`,
          type: 'WITHDRAWAL_COMPLETED',
          storeId,
          withdrawalId,
          source: 'system',
          occurredAt: new Date().toISOString()
        }).catch(console.error);
      });

      const newLedgerDoc = ledgerRef.doc();
      const ledgerEntry: WalletLedgerEntry = {
        id: newLedgerDoc.id,
        storeId,
        type: 'WITHDRAWAL_COMPLETED',
        amountCents: Number(wData.amountCents) || Math.round((Number(wData.amount) || 0) * 100),
        feeCents: Number(wData.feeCents) || FinancialWalletService.WITHDRAW_FEE_CENTS,
        netAmountCents: totalDeductedCents,
        currency: 'BRL',
        balanceBucket: 'reserved',
        referenceType: 'withdrawal',
        referenceId: withdrawalId,
        idempotencyKey: `ledger-comp-${withdrawalId}`,
        metadata: {
          misticTransactionId: misticTransactionId || null,
          requestId: requestId || null
        },
        createdAt: FieldValue.serverTimestamp()
      };
      t.set(newLedgerDoc, ledgerEntry);
    });

    import('./server-notification-service.js').then(({ processEvent }) => {
      processEvent({
        eventId: `WD_FAILED_${params.withdrawalId}`,
        type: 'WITHDRAWAL_FAILED',
        storeId: params.storeId,
        withdrawalId: params.withdrawalId,
        source: 'system',
        occurredAt: new Date().toISOString()
      }).catch(console.error);
    });
  }

  /**
   * Liberação de reserva (Rollback do saque em caso de falha no gateway).
   * Devolve de reservedBalanceCents para availableBalanceCents.
   */
  static async releaseWithdrawalReservation(
    db: any,
    params: { storeId: string; withdrawalId: string; reason?: string; requestId?: string }
  ): Promise<void> {
    const { storeId, withdrawalId, reason, requestId } = params;
    const storeRef = db.collection('stores').doc(storeId);
    const walletRef = storeRef.collection('wallet').doc('main');
    const withdrawalRef = storeRef.collection('withdrawals').doc(withdrawalId);
    const ledgerRef = storeRef.collection('walletLedger');

    await db.runTransaction(async (t: any) => {
      const wDoc = await t.get(withdrawalRef);
      if (!wDoc.exists) return;
      const wData = wDoc.data();

      // Se já finalizado ou já liberado, idempotência estrita
      if (wData.status === 'completed' || wData.status === 'failed') return;

      const totalDeductedCents = Number(wData.totalDeductedCents) || Math.round((Number(wData.totalDeducted) || 0) * 100);

      const walletSnap = await t.get(walletRef);
      if (walletSnap.exists) {
        const w = walletSnap.data() as WalletDocument;
        const currentReserved = Number(w.reservedBalanceCents) || 0;
        if (currentReserved < totalDeductedCents) {
           throw new Error('Invariante violada: saldo reservado insuficiente para a operação.');
        }
        const nextReserved = currentReserved - totalDeductedCents;
        const nextAvailable = (Number(w.availableBalanceCents) || 0) + totalDeductedCents;

        t.set(
          walletRef,
          {
            reservedBalanceCents: nextReserved,
            availableBalanceCents: nextAvailable,
            version: (Number(w.version) || 1) + 1,
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }

      t.update(withdrawalRef, {
        status: 'failed',
        failureReason: reason || 'Falha ao processar transferência',
        updatedAt: FieldValue.serverTimestamp()
      });

      const newLedgerDoc = ledgerRef.doc();
      const ledgerEntry: WalletLedgerEntry = {
        id: newLedgerDoc.id,
        storeId,
        type: 'WITHDRAWAL_RELEASED',
        amountCents: Number(wData.amountCents) || Math.round((Number(wData.amount) || 0) * 100),
        feeCents: Number(wData.feeCents) || FinancialWalletService.WITHDRAW_FEE_CENTS,
        netAmountCents: totalDeductedCents,
        currency: 'BRL',
        balanceBucket: 'available',
        referenceType: 'withdrawal',
        referenceId: withdrawalId,
        idempotencyKey: `ledger-rel-${withdrawalId}`,
        metadata: {
          reason: reason || 'Falha no gateway',
          requestId: requestId || null
        },
        createdAt: FieldValue.serverTimestamp()
      };
      t.set(newLedgerDoc, ledgerEntry);
    });
  }

  /**
   * Processamento completo de solicitação de saque (Reserva -> Gateway -> Confirmação ou Liberação).
   */
  static async processWithdrawal(params: WithdrawalParams, db: any): Promise<WithdrawalResult> {
    const requestId = params.requestId || crypto.randomUUID();

    let reservation: { withdrawal: any; wallet: WalletDocument; isExisting?: boolean };
    try {
      reservation = await FinancialWalletService.reserveWithdrawal(db, {
        ...params,
        requestId
      });
    } catch (err: any) {
      return {
        success: false,
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Erro ao processar reserva financeira de saque.',
        requestId
      };
    }

    const withdrawal = reservation.withdrawal;
    const withdrawalId = withdrawal.id;

    // Se a operação já existia com a mesma chave de idempotência e mesmos dados, retorna imediatamente sem chamar a MisticPay novamente
    if (reservation.isExisting) {
      return {
        success: true,
        withdrawalId,
        misticTransactionId: withdrawal.misticTransactionId || null,
        message: 'Solicitação de saque já registrada anteriormente para esta chave de idempotência.',
        requestId
      };
    }

    // FASE 2: EXECUÇÃO NO GATEWAY EXTERNO (MISTIC PAY)
    const MISTIC_API_URL = 'https://api.misticpay.com/api';
    const clientId = process.env.MISTIC_PAY_CLIENT_ID;
    const clientSecret = process.env.MISTIC_PAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      await FinancialWalletService.releaseWithdrawalReservation(db, {
        storeId: params.storeId,
        withdrawalId,
        reason: 'Credenciais MisticPay ausentes no servidor',
        requestId
      });

      return {
        success: false,
        code: 'CONFIG_ERROR',
        message: 'As credenciais do provedor de pagamento não estão configuradas no servidor.',
        requestId
      };
    }

    try {
      const base64Auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const webhookSecret = (process.env.MISTIC_PAY_WEBHOOK_SECRET || '').trim();
      if (!webhookSecret) {
        console.error(`[MisticPay Withdrawal] Erro crítico: MISTIC_PAY_WEBHOOK_SECRET não configurado.`);
        return {
          success: false,
          
          code: 'CONFIG_ERROR',
          message: 'Configuração do gateway incompleta (MISTIC_PAY_WEBHOOK_SECRET ausente).',
          requestId
        };
      }
      // The host is injected into APP_URL during runtime in server-wallet if not set, or we default it
      const host = params.requestHost || process.env.APP_URL || 'marketplace.frontmk.online';
      const baseAppUrl = host.startsWith('http') ? host.replace(/\/+$/, '') : `https://${host.replace(/\/+$/, '')}`;
      const webhookUrl = `${baseAppUrl}/api/webhook/misticpay?token=${encodeURIComponent(webhookSecret)}`;

      // Timeout explícito com AbortController (15s)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      let misticResponse: any;
      try {
        misticResponse = await fetch(`${MISTIC_API_URL}/transactions/withdraw`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${base64Auth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: withdrawal.amount,
            pixKey: withdrawal.pixKey,
            pixKeyType: withdrawal.pixKeyType,
            description: `Saque Loja ${params.storeId.slice(-6).toUpperCase()}`,
            projectWebhook: webhookUrl
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      let misticData: any = null;
      const contentType = misticResponse.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        misticData = await misticResponse.json();
      } else {
        const textData = await misticResponse.text();
        misticData = { raw: textData.substring(0, 300) };
      }

      // Rejeição definitiva confirmada (400, 401, 403, 422)
      if (misticResponse.status === 400 || misticResponse.status === 401 || misticResponse.status === 403 || misticResponse.status === 422) {
        const errorReason = misticData?.message || misticData?.error || `HTTP ${misticResponse.status}`;
        await FinancialWalletService.releaseWithdrawalReservation(db, {
          storeId: params.storeId,
          withdrawalId,
          reason: `Rejeitado pelo provedor: ${errorReason}`,
          requestId
        });

        return {
          success: false,
          code: 'PROVIDER_REJECTED',
          message: errorReason,
          requestId
        };
      }

      // Erro 5xx no servidor da MisticPay: Estado ambíguo (a MisticPay pode ter enfileirado)
      if (!misticResponse.ok) {
        const errorReason = misticData?.message || misticData?.error || `HTTP ${misticResponse.status}`;
        const withdrawalRef = db.collection('stores').doc(params.storeId).collection('withdrawals').doc(withdrawalId);
        await withdrawalRef.update({
          status: 'reconciliation_required',
          failureReason: `Resposta ambígua do gateway: ${errorReason}`,
          updatedAt: FieldValue.serverTimestamp()
        });

        return {
          success: false,
          code: 'RECONCILIATION_REQUIRED',
          message: 'A transferência foi transmitida mas a resposta do gateway foi incerta. Seu saldo permanece reservado com total segurança e será reconciliado.',
          requestId
        };
      }

      // SUCESSO HTTP 200/201: A MisticPay coloca o saque na fila (QUEUED)
      const misticTransactionId = misticData?.data?.transactionId || null;
      const misticJobId = misticData?.data?.jobId || null;
      const providerStatus = misticData?.data?.status || 'QUEUED';

      const withdrawalRef = db.collection('stores').doc(params.storeId).collection('withdrawals').doc(withdrawalId);
      await withdrawalRef.update({
        status: 'provider_pending',
        providerStatus,
        misticTransactionId,
        misticJobId,
        updatedAt: FieldValue.serverTimestamp()
      });

      return {
        success: true,
        withdrawalId,
        misticTransactionId,
        message: 'Saque solicitado com sucesso! A transferência PIX está na fila de processamento bancário.',
        requestId
      };
    } catch (gatewayErr: any) {
      console.error(`[FinancialWalletService] Falha/Timeout no gateway (req: ${requestId}):`, gatewayErr.message);

      // Em caso de timeout ou erro de rede, o backend NÃO sabe se o provedor processou.
      // Manter a reserva! Atualizar para reconciliation_required.
      try {
        const withdrawalRef = db.collection('stores').doc(params.storeId).collection('withdrawals').doc(withdrawalId);
        await withdrawalRef.update({
          status: 'reconciliation_required',
          failureReason: gatewayErr.message || 'Timeout de comunicação',
          updatedAt: FieldValue.serverTimestamp()
        });
      } catch (updateErr: any) {
        console.error('[FinancialWalletService] Erro ao marcar reconciliation_required:', updateErr.message);
      }

      return {
        success: false,
        code: 'RECONCILIATION_REQUIRED',
        message: 'Houve lentidão ou timeout na resposta do gateway. Para sua segurança financeira, o saldo permanece reservado e a transação será reconciliada sem duplicações.',
        requestId
      };
    }
  }

  /**
   * Reconcilia um saque específico consultando a API da MisticPay (/api/transactions/check).
   */
  static async reconcileWithdrawal(
    db: any,
    params: { storeId: string; withdrawalId: string }
  ): Promise<{ reconciled: boolean; status: string; reason?: string }> {
    const { storeId, withdrawalId } = params;
    const storeRef = db.collection('stores').doc(storeId);
    const withdrawalRef = storeRef.collection('withdrawals').doc(withdrawalId);

    const doc = await withdrawalRef.get();
    if (!doc.exists) {
      return { reconciled: false, status: 'NOT_FOUND', reason: 'Documento não encontrado' };
    }

    const data = doc.data();
    if (data.status === 'completed' || data.status === 'failed') {
      return { reconciled: true, status: data.status, reason: 'Já finalizado anteriormente' };
    }

    const transactionId = data.misticTransactionId;
    if (!transactionId) {
      return { reconciled: false, status: data.status, reason: 'Sem transactionId do provedor' };
    }

    const clientId = process.env.MISTIC_PAY_CLIENT_ID;
    const clientSecret = process.env.MISTIC_PAY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return { reconciled: false, status: data.status, reason: 'Credenciais ausentes' };
    }

    try {
      const MISTIC_API_URL = 'https://api.misticpay.com/api';
      const base64Auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const res = await fetch(`${MISTIC_API_URL}/transactions/check`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${base64Auth}`,
          'ci': clientId,
          'cs': clientSecret,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transactionId: String(transactionId) })
      });

      if (!res.ok) {
        return { reconciled: false, status: data.status, reason: `HTTP ${res.status} ao consultar check` };
      }

      const json: any = await res.json();
      const state = json?.transaction?.transactionState || json?.data?.transactionState || json?.status;

      if (state === 'COMPLETO' || state === 'COMPLETED' || state === 'SUCESSO') {
        await FinancialWalletService.confirmWithdrawal(db, {
          storeId,
          withdrawalId,
          misticTransactionId: transactionId
        });
        return { reconciled: true, status: 'completed' };
      }

      if (state === 'FALHA' || state === 'FAILED' || state === 'REJEITADO' || state === 'CANCELADO') {
        await FinancialWalletService.releaseWithdrawalReservation(db, {
          storeId,
          withdrawalId,
          reason: `Rejeitado na verificação: ${state}`
        });
        return { reconciled: true, status: 'failed' };
      }

      return { reconciled: false, status: data.status, reason: `Estado intermediário no provedor: ${state}` };
    } catch (err: any) {
      return { reconciled: false, status: data.status, reason: err.message };
    }
  }

  /**
   * Reconcilia em lote todos os saques pendentes ou em status incerto.
   */
  static async reconcilePendingWithdrawals(db: any): Promise<{ processed: number; completed: number; failed: number }> {
    let processed = 0;
    let completed = 0;
    let failed = 0;

    try {
      const candidates = await db
        .collectionGroup('withdrawals')
        .where('status', 'in', ['provider_pending', 'reconciliation_required', 'processing', 'reserved'])
        .get();

      const now = Date.now();
      for (const doc of candidates.docs) {
        const data = doc.data();
        const storeId = data.storeId;
        const withdrawalId = doc.id;

        // Só reconcilia saques com pelo menos 2 minutos para dar tempo do webhook chegar naturalmente
        const createdAtMs = data.createdAt?.toMillis
          ? data.createdAt.toMillis()
          : data.createdAt?.seconds
          ? data.createdAt.seconds * 1000
          : 0;
        if (now - createdAtMs < 2 * 60 * 1000) {
          continue;
        }

        if (data.misticTransactionId) {
          processed++;
          const res = await FinancialWalletService.reconcileWithdrawal(db, { storeId, withdrawalId });
          if (res.reconciled) {
            if (res.status === 'completed') completed++;
            else if (res.status === 'failed') failed++;
          }
        }
      }
    } catch (err: any) {
      console.error('[FinancialWalletService] Erro na reconciliação periódica de saques:', err.message);
    }

    return { processed, completed, failed };
  }

  /**
   * Obtém detalhes consolidados da carteira para visualização no dashboard.
   */
  static async getWalletDetails(db: any, storeId: string) {
    const wallet = await FinancialWalletService.getOrCreateWallet(db, storeId);
    const storeRef = db.collection('stores').doc(storeId);

    const withdrawalsSnap = await storeRef
      .collection('withdrawals')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const withdrawals: any[] = [];
    withdrawalsSnap.forEach((doc: any) => {
      const data = doc.data();
      withdrawals.push({
        id: doc.id,
        ...data,
        pixKey: maskPixKey(data.pixKey, data.pixKeyType),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
      });
    });

    const ledgerSnap = await storeRef
      .collection('walletLedger')
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();

    const ledger: any[] = [];
    ledgerSnap.forEach((doc: any) => {
      const data = doc.data();
      ledger.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
      });
    });

    // Contagem de pedidos aprovados para resumo visual
    let approvedCount = 0;
    try {
      const ordersSnap = await storeRef.collection('orders').where('status', '==', 'paid').get();
      approvedCount = ordersSnap.size;
    } catch (_) {}

    // Próximas liberações programadas D+3 (apenas pendentes)
    const pendingReleases: any[] = [];
    let nextReleaseAt: string | null = null;
    try {
      const releasesSnap = await storeRef
        .collection('paymentReleases')
        .where('status', '==', 'pending')
        .orderBy('releaseAt', 'asc')
        .limit(15)
        .get();

      releasesSnap.forEach((doc: any) => {
        const data = doc.data();
        const releaseAtIso = data.releaseAt?.toDate ? data.releaseAt.toDate().toISOString() : data.releaseAt;
        const confirmedAtIso = data.confirmedAt?.toDate ? data.confirmedAt.toDate().toISOString() : data.confirmedAt;

        if (!nextReleaseAt && releaseAtIso) {
          nextReleaseAt = releaseAtIso;
        }

        pendingReleases.push({
          id: doc.id,
          orderId: data.orderId,
          amountCents: data.amountCents,
          feeCents: data.feeCents,
          netAmountCents: data.netAmountCents,
          amount: (data.amountCents || 0) / 100,
          netAmount: (data.netAmountCents || 0) / 100,
          paymentMethod: data.paymentMethod || 'pix',
          status: data.status,
          confirmedAt: confirmedAtIso,
          releaseAt: releaseAtIso
        });
      });
    } catch (relErr) {
      console.warn(`[getWalletDetails] Aviso ao carregar paymentReleases de ${storeId}:`, relErr);
    }

    return {
      wallet: {
        pendingBalanceCents: wallet.pendingBalanceCents,
        availableBalanceCents: wallet.availableBalanceCents,
        reservedBalanceCents: wallet.reservedBalanceCents,
        totalReceivedCents: wallet.totalReceivedCents,
        totalWithdrawnCents: wallet.totalWithdrawnCents,
        currency: wallet.currency,
        version: wallet.version,
        // Projeções para exibição em Reais
        availableBalance: wallet.availableBalanceCents / 100,
        pendingBalance: wallet.pendingBalanceCents / 100,
        blockedBalance: wallet.pendingBalanceCents / 100,
        reservedBalance: wallet.reservedBalanceCents / 100,
        totalReceived: wallet.totalReceivedCents / 100,
        grossSales: wallet.totalReceivedCents / 100,
        totalWithdrawn: wallet.totalWithdrawnCents / 100,
        approvedCount,
        nextReleaseAt,
        pendingReleasesCount: pendingReleases.length
      },
      withdrawals,
      ledger,
      pendingReleases
    };
  }
}

// Re-exporta como WithdrawalService para preservar compatibilidade direta
export const WithdrawalService = FinancialWalletService;
