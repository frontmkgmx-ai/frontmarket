import { getAdminDb } from './server-firebase-admin.js';
import { sendEmail } from './server-email.js';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

export type EventType = 
  | 'ORDER_CREATED'
  | 'ORDER_PAYMENT_PENDING'
  | 'SALE_CREATED'
  | 'ORDER_PAYMENT_CONFIRMED'
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_CANCELLED'
  | 'ORDER_REFUNDED'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'WITHDRAWAL_CREATED'
  | 'WITHDRAWAL_PROCESSING'
  | 'WITHDRAWAL_COMPLETED'
  | 'WITHDRAWAL_FAILED'
  | 'WALLET_CREDITED'
  | 'PAYMENT_RELEASED_D3'
  | 'D3_RELEASE_CREATED'
  | 'D3_BALANCE_RELEASED'
  | 'KYC_STATUS_CHANGED'
  | 'KYC_APPROVED'
  | 'KYC_DECLINED'
  | 'KYC_REVIEW'
  | 'KYC_EXPIRED'
  | 'MED_CREATED'
  | 'MED_UPDATED';

export interface BaseEvent {
  eventId: string;
  type: EventType;
  storeId?: string;
  userId?: string;
  orderId?: string;
  withdrawalId?: string;
  paymentId?: string;
  kycSessionId?: string;
  source: string;
  occurredAt: string;
  metadata?: any;
}

export async function processEvent(event: BaseEvent) {
  const db = getAdminDb();
  const idempotencyKey = crypto.createHash('sha256').update(`${event.type}_${event.eventId}`).digest('hex');
  const eventDocRef = db.collection('system_events').doc(idempotencyKey);
  
  const result = await db.runTransaction(async (t) => {
    const snap = await t.get(eventDocRef);
    if (snap.exists) {
      return { alreadyProcessed: true };
    }
    t.set(eventDocRef, { ...event, processedAt: FieldValue.serverTimestamp() });
    return { alreadyProcessed: false };
  });

  if (result.alreadyProcessed) {
    console.log(`[Notification Service] Event ${event.type} (${event.eventId}) already processed.`);
    return;
  }

  // Handle internal notifications and emails
  await handleInternalNotifications(db, event);
  await handleEmails(db, event);
}

async function handleInternalNotifications(db: any, event: BaseEvent) {
  if (!event.storeId) return;

  let title = '';
  let message = '';
  let type = 'info';

  switch (event.type) {
    case 'SALE_CREATED':
      title = 'Nova venda';
      message = `Você realizou uma nova venda no pedido #${event.orderId?.slice(-6).toUpperCase()}.`;
      type = 'success';
      break;
    case 'ORDER_PAYMENT_CONFIRMED':
      title = 'Pagamento Confirmado';
      message = `O pagamento do pedido #${event.orderId?.slice(-6).toUpperCase()} foi confirmado.`;
      type = 'success';
      break;
    case 'ORDER_STATUS_CHANGED':
      title = 'Status do Pedido Atualizado';
      message = `O pedido #${event.orderId?.slice(-6).toUpperCase()} mudou de status.`;
      type = 'info';
      break;
    case 'ORDER_REFUNDED':
      title = 'Reembolso Solicitado';
      message = `O pedido #${event.orderId?.slice(-6).toUpperCase()} foi reembolsado.`;
      type = 'success';
      break;
    case 'ORDER_CREATED':
      title = 'Novo Pedido';
      message = `Você recebeu um novo pedido #${event.orderId?.slice(-6).toUpperCase()}.`;
      type = 'info';
      break;
    case 'KYC_APPROVED':
      title = 'Documentação Aprovada';
      message = 'Sua verificação de identidade foi aprovada com sucesso. Seus saques estão liberados!';
      type = 'success';
      break;
    case 'KYC_DECLINED':
      title = 'Documentação Recusada';
      message = 'Houve um problema com sua verificação de identidade. Por favor, acesse as Configurações.';
      type = 'error';
      break;
    case 'WITHDRAWAL_CREATED':
      title = 'Saque Solicitado';
      message = `Seu saque foi solicitado e está em processamento.`;
      type = 'info';
      break;
    case 'WITHDRAWAL_FAILED':
      title = 'Saque Falhou';
      message = `Seu saque não foi concluído.`;
      type = 'error';
      break;
    case 'WITHDRAWAL_COMPLETED':
      title = 'Saque Concluído';
      message = `Seu saque foi processado com sucesso.`;
      type = 'success';
      break;
    case 'PAYMENT_RELEASED_D3':
    case 'D3_BALANCE_RELEASED':
      title = 'Pagamento Liberado (D+3)';
      message = `Um pagamento foi liberado para saque.`;
      type = 'success';
      break;
    case 'D3_RELEASE_CREATED':
      title = 'Pagamento em Processamento';
      message = `Um pagamento foi confirmado e será liberado em 3 dias úteis.`;
      type = 'info';
      break;
    default:
      return; // No notification for this event
  }

  const notification = {
    title,
    message,
    type,
    read: false,
    createdAt: new Date().toISOString(),
    eventId: event.eventId,
    source: event.source
  };

  // Enviar para o store
  if (event.storeId) {
     const dedupeKey = `${event.type}_${event.storeId}_${event.eventId}`;
     const notifRef = db.collection('stores').doc(event.storeId).collection('notifications').doc(crypto.createHash('sha256').update(dedupeKey).digest('hex'));
     
     const docSnap = await notifRef.get();
     if (!docSnap.exists) {
       await notifRef.set(notification);
     }
  }
}

async function handleEmails(db: any, event: BaseEvent) {
  if (!event.storeId) return;
  if (event.type === 'ORDER_PAYMENT_CONFIRMED' || event.type === 'ORDER_REFUNDED' || event.type === 'ORDER_CANCELLED') {
    // This is basically triggerOrderStatusEmail but inside the centralized event handler
    const statusMap: any = {
      'ORDER_PAYMENT_CONFIRMED': 'paid',
      'ORDER_REFUNDED': 'refunded',
      'ORDER_CANCELLED': 'canceled'
    };
    const newStatus = statusMap[event.type];
    const { triggerOrderStatusEmail } = await import('./server-email-triggers.js');
    await triggerOrderStatusEmail(event.storeId, event.orderId!, newStatus);
  }
}
