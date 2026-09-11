import { FinancialWalletService } from './server-financial-service';

let schedulerInterval: NodeJS.Timeout | null = null;
let isJobRunning = false;

/**
 * Inicia a rotina periódica e autônoma de liberação D+3 (72h completas).
 * Executa independentemente de qualquer interação de frontend ou rotas de saque.
 */
export function startD3Scheduler(getDb: () => any, intervalMs = 60000) {
  if (schedulerInterval) {
    console.log('[D+3 Scheduler] Job periódico já está em execução.');
    return;
  }

  console.log(`[D+3 Scheduler] Iniciando worker financeiro autônomo (intervalo: ${intervalMs / 1000}s)...`);

  const runReleaseCycle = async () => {
    if (isJobRunning) {
      console.log('[D+3 Scheduler] Ciclo anterior ainda em execução. Ignorando tick.');
      return;
    }

    isJobRunning = true;
    try {
      const db = getDb();
      if (!db) {
        return;
      }

      const result = await FinancialWalletService.processEligibleReleases(db);

      if (result.totalFound > 0) {
        console.log(
          `[D+3 Scheduler] Processamento concluído: ${result.releasedCount} liberados, ` +
          `${result.alreadyReleasedCount} já liberados, ${result.errorCount} erros. ` +
          `Duração: ${result.durationMs}ms.`
        );
      }

      // Reconciliação periódica de saques pendentes/incertos com MisticPay
      const recResult = await FinancialWalletService.reconcilePendingWithdrawals(db);
      if (recResult.processed > 0) {
        console.log(
          `[D+3 Scheduler] Reconciliação de saques: ${recResult.processed} verificados, ` +
          `${recResult.completed} confirmados, ${recResult.failed} liberados/recusados.`
        );
      }
    } catch (err: any) {
      console.error('[D+3 Scheduler] Erro não tratado no ciclo de liberação:', err?.message || err);
    } finally {
      isJobRunning = false;
    }
  };

  // 1. Executa o backfill inicial de ordens existentes (não-destrutivo)
  setTimeout(async () => {
    try {
      const db = getDb();
      if (db) {
        const backfillRes = await FinancialWalletService.backfillPaymentReleases(db);
        if (backfillRes.created > 0) {
          console.log(`[D+3 Scheduler] Backfill auditado: ${backfillRes.created} agendamentos registrados.`);
        }
      }
    } catch (bfErr: any) {
      console.warn('[D+3 Scheduler] Aviso no backfill inicial:', bfErr?.message || bfErr);
    }

    // 2. Executa a primeira varredura logo após a subida
    runReleaseCycle();
  }, 3000);

  // 3. Agenda o ciclo contínuo a cada 60s
  schedulerInterval = setInterval(runReleaseCycle, intervalMs);
}

export function stopD3Scheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[D+3 Scheduler] Worker parado.');
  }
}
