import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

export interface WithdrawalParams {
  storeId: string;
  uid: string;
  amount: number;
  pixKey: string;
  pixKeyType: string;
  idempotencyKey?: string;
  gateway?: string;
}

export interface WithdrawalResult {
  success: boolean;
  code?: string;
  message: string;
  withdrawalId?: string;
  misticTransactionId?: string | number;
  details?: any;
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

export class WithdrawalService {
  /**
   * Processa uma solicitação de saque de forma atômica e em duas fases (Reserva -> Gateway -> Confirmação/Rollback).
   */
  static async processWithdrawal(params: WithdrawalParams, db: any): Promise<WithdrawalResult> {
    const { storeId, uid, amount, pixKey, pixKeyType, idempotencyKey, gateway = 'misticpay' } = params;

    // 1. Validações preliminares de entrada
    if (!uid) {
      return { success: false, code: 'FORBIDDEN', message: 'Usuário não autenticado.' };
    }

    if (!storeId) {
      return { success: false, code: 'STORE_NOT_FOUND', message: 'Identificador da loja não fornecido.' };
    }

    const withdrawAmount = Number(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return { success: false, code: 'INVALID_AMOUNT', message: 'Valor de saque inválido.' };
    }

    if (withdrawAmount < 20) {
      return { success: false, code: 'INVALID_AMOUNT', message: 'O valor mínimo para solicitação de saque é de R$ 20,00.' };
    }

    const validTypes = ['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'CHAVE_ALEATORIA'];
    const normalizedType = pixKeyType?.toUpperCase() || 'CPF';
    if (!validTypes.includes(normalizedType)) {
      return { success: false, code: 'INVALID_PIX_KEY', message: 'Tipo de chave PIX inválido.' };
    }

    if (!validatePixKey(pixKey, normalizedType)) {
      return { success: false, code: 'INVALID_PIX_KEY', message: `Formato de chave PIX inválido para o tipo ${normalizedType}.` };
    }

    const sanitizedKey = sanitizePixKey(pixKey, normalizedType);
    const WITHDRAW_FEE = 10.0;
    const totalNeeded = withdrawAmount + WITHDRAW_FEE;

    const iKey = idempotencyKey || crypto.createHash('sha256').update(`${uid}-${storeId}-${withdrawAmount}-${sanitizedKey}-${Date.now()}`).digest('hex');

    const storeRef = db.collection('stores').doc(storeId);
    const withdrawalsRef = storeRef.collection('withdrawals');
    const ordersRef = storeRef.collection('orders');
    const ledgerRef = storeRef.collection('walletLedger');

    let reservationResult: any = null;

    // FASE 1: RESERVA ATÔMICA VIA TRANSAÇÃO FIRESTORE
    try {
      reservationResult = await db.runTransaction(async (t: any) => {
        // Validação de segurança: apenas o proprietário da loja pode sacar
        const storeDoc = await t.get(storeRef);
        if (!storeDoc.exists) {
          throw new Error('STORE_NOT_FOUND');
        }
        if (storeDoc.data().ownerId !== uid) {
          throw new Error('FORBIDDEN');
        }

        // Validação de idempotência
        const existingWithdrawalQuery = await t.get(withdrawalsRef.where('idempotencyKey', '==', iKey).limit(1));
        if (!existingWithdrawalQuery.empty) {
          throw new Error('IDEMPOTENT_DUPLICATE');
        }

        // Cálculo de saldo disponível: pedidos pagos com liberação D+3
        const ordersQuery = await t.get(ordersRef.where('status', '==', 'paid'));
        let availableBalanceAcc = 0;
        const now = Date.now();
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

        ordersQuery.forEach((doc: any) => {
          const order = doc.data();
          const value = order.total || 0;
          const method = order.paymentMethod || 'pix';

          let fee = 0;
          if (method === 'credit_card' || method === 'debit_card') fee = value * 0.13;
          else if (method === 'boleto') fee = value * 0.09;
          else fee = value * 0.07;

          const netValue = value - fee;
          let paidAtTime = 0;

          if (order.paidAt) {
            paidAtTime = typeof order.paidAt.toDate === 'function' ? order.paidAt.toDate().getTime() : new Date(order.paidAt).getTime();
          } else if (order.createdAt) {
            paidAtTime = typeof order.createdAt.toDate === 'function' ? order.createdAt.toDate().getTime() : new Date(order.createdAt).getTime();
          } else {
            paidAtTime = now;
          }

          if (now - paidAtTime >= THREE_DAYS_MS) {
            availableBalanceAcc += netValue;
          }
        });

        // Subtrair saques ativos (pending, processing, completed)
        // Saques com status 'failed' ou 'rejected' são desconsiderados
        const withdrawalsQuery = await t.get(withdrawalsRef);
        let totalWithdrawn = 0;
        withdrawalsQuery.forEach((doc: any) => {
          const w = doc.data();
          if (w.status === 'pending' || w.status === 'processing' || w.status === 'completed') {
            totalWithdrawn += (w.amount || 0);
            totalWithdrawn += (w.fee || WITHDRAW_FEE);
          }
        });

        const availableBalance = Math.max(availableBalanceAcc - totalWithdrawn, 0);

        if (totalNeeded > availableBalance) {
          throw new Error(`INSUFFICIENT_BALANCE|${availableBalance.toFixed(2)}`);
        }

        // Criação do documento de saque com status 'processing' (Reserva efetuada)
        const newWithdrawalRef = withdrawalsRef.doc();
        const withdrawalData = {
          id: newWithdrawalRef.id,
          storeId,
          amount: withdrawAmount,
          fee: WITHDRAW_FEE,
          totalDeducted: totalNeeded,
          status: 'processing',
          pixKey: sanitizedKey,
          pixKeyType: normalizedType,
          gateway,
          idempotencyKey: iKey,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };
        t.set(newWithdrawalRef, withdrawalData);

        // Registro de Auditoria / Ledger: Reserva de Saldo
        const newLedgerRef = ledgerRef.doc();
        t.set(newLedgerRef, {
          id: newLedgerRef.id,
          storeId,
          withdrawalId: newWithdrawalRef.id,
          type: 'WITHDRAWAL_RESERVED',
          amount: withdrawAmount,
          fee: WITHDRAW_FEE,
          total: totalNeeded,
          status: 'reserved',
          createdAt: FieldValue.serverTimestamp()
        });

        return withdrawalData;
      });
    } catch (err: any) {
      console.error('[WithdrawalService] Erro na reserva atômica:', err.message);

      if (err.message === 'STORE_NOT_FOUND') {
        return { success: false, code: 'STORE_NOT_FOUND', message: 'Loja não encontrada.' };
      }
      if (err.message === 'FORBIDDEN') {
        return { success: false, code: 'FORBIDDEN', message: 'Acesso negado. Você não é o proprietário desta loja.' };
      }
      if (err.message === 'IDEMPOTENT_DUPLICATE') {
        return { success: false, code: 'IDEMPOTENT_DUPLICATE', message: 'Esta solicitação de saque já foi enviada ou está em processamento.' };
      }
      if (err.message?.startsWith('INSUFFICIENT_BALANCE')) {
        const bal = err.message.split('|')[1] || '0.00';
        return {
          success: false,
          code: 'INSUFFICIENT_BALANCE',
          message: `Saldo insuficiente para realizar o saque (Valor solicitado: R$ ${withdrawAmount.toFixed(2)} + Taxa: R$ ${WITHDRAW_FEE.toFixed(2)} = R$ ${totalNeeded.toFixed(2)}). Seu saldo disponível é de R$ ${bal}.`
        };
      }

      // Detecção de ausência de service account no Firebase Admin
      if (err.code === 7 || err.message?.includes('PERMISSION_DENIED') || err.message?.includes('Missing or insufficient permissions')) {
        return {
          success: false,
          code: 'CONFIG_ERROR',
          message: 'Permissão negada no banco de dados. Configure a variável FIREBASE_SERVICE_ACCOUNT com a chave de serviço do Firebase para habilitar operações de carteira no servidor.'
        };
      }

      return {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Erro interno ao processar a reserva de saldo.',
        details: err.message
      };
    }

    // FASE 2: EXECUÇÃO NO GATEWAY EXTERNO (MISTIC PAY)
    const withdrawalId = reservationResult.id;
    const MISTIC_API_URL = 'https://api.misticpay.com/api';
    const clientId = process.env.MISTIC_PAY_CLIENT_ID;
    const clientSecret = process.env.MISTIC_PAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      // Rollback da reserva se as chaves do gateway não estiverem configuradas
      await withdrawalsRef.doc(withdrawalId).update({
        status: 'failed',
        failureReason: 'Chaves da Mistic Pay não configuradas no servidor.',
        updatedAt: FieldValue.serverTimestamp()
      });
      await ledgerRef.add({
        storeId,
        withdrawalId,
        type: 'WITHDRAWAL_RELEASED',
        amount: withdrawAmount,
        reason: 'Chaves MisticPay ausentes',
        createdAt: FieldValue.serverTimestamp()
      });

      return {
        success: false,
        code: 'CONFIG_ERROR',
        message: 'As chaves de integração da Mistic Pay não estão configuradas no servidor (MISTIC_PAY_CLIENT_ID e MISTIC_PAY_CLIENT_SECRET).'
      };
    }

    try {
      const base64Auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const webhookUrl = `${process.env.APP_URL || 'https://marketplace.frontmk.online'}/api/webhook/misticpay`;

      // Chamada para a API MisticPay conforme documentação oficial: POST /api/transactions/withdraw
      const misticResponse = await fetch(`${MISTIC_API_URL}/transactions/withdraw`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${base64Auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: withdrawAmount,
          pixKey: sanitizedKey,
          pixKeyType: normalizedType,
          description: `Saque Loja ${storeId.slice(-6).toUpperCase()}`,
          projectWebhook: webhookUrl
        })
      });

      let misticData: any = null;
      const contentType = misticResponse.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        misticData = await misticResponse.json();
      } else {
        const textData = await misticResponse.text();
        misticData = { raw: textData.substring(0, 500) };
      }

      if (!misticResponse.ok) {
        console.error('[WithdrawalService] Resposta de erro da Mistic Pay:', misticData);
        throw new Error(misticData?.message || misticData?.error || `HTTP ${misticResponse.status}`);
      }

      const misticTransactionId = misticData?.data?.transactionId || misticData?.data?.jobId || null;

      // 3A. SUCESSO NO GATEWAY: Confirmação do saque
      await withdrawalsRef.doc(withdrawalId).update({
        status: 'completed',
        misticTransactionId,
        updatedAt: FieldValue.serverTimestamp()
      });

      await ledgerRef.add({
        storeId,
        withdrawalId,
        type: 'WITHDRAWAL_CONFIRMED',
        amount: withdrawAmount,
        fee: WITHDRAW_FEE,
        misticTransactionId,
        createdAt: FieldValue.serverTimestamp()
      });

      return {
        success: true,
        withdrawalId,
        misticTransactionId,
        message: 'Saque solicitado com sucesso! A transferência PIX será processada imediatamente.'
      };

    } catch (gatewayErr: any) {
      console.error('[WithdrawalService] Falha no envio para o gateway:', gatewayErr.message);

      // 3B. FALHA NO GATEWAY: Rollback da reserva (status 'failed' libera o saldo de volta)
      await withdrawalsRef.doc(withdrawalId).update({
        status: 'failed',
        failureReason: gatewayErr.message || 'Falha na comunicação com o gateway',
        updatedAt: FieldValue.serverTimestamp()
      });

      await ledgerRef.add({
        storeId,
        withdrawalId,
        type: 'WITHDRAWAL_RELEASED',
        amount: withdrawAmount,
        fee: WITHDRAW_FEE,
        reason: gatewayErr.message || 'Erro no gateway',
        createdAt: FieldValue.serverTimestamp()
      });

      return {
        success: false,
        code: 'GATEWAY_ERROR',
        message: `Falha ao transferir via PIX: ${gatewayErr.message || 'Erro na provedora de pagamento'}. O valor foi devolvido ao seu saldo disponível.`,
        details: gatewayErr.message
      };
    }
  }
}
