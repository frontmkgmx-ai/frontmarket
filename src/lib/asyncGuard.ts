/**
 * Async Guard Utility
 * Prevents network calls and Firestore operations from hanging indefinitely.
 */

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 4000,
  fallbackValue?: T,
  errorMessage: string = 'Tempo limite de conexão excedido.'
): Promise<T> {
  let timeoutId: any;

  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (fallbackValue !== undefined) {
        resolve(fallbackValue);
      } else {
        reject(new Error(errorMessage));
      }
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    throw err;
  }
}

/**
 * Executa uma operação de escrita no Firestore de forma otimista.
 * Ele aguarda um tempo curto (ex: 2000ms) para ver se a operação conclui ou falha.
 * Se demorar mais que o tempo estipulado (por lentidão na rede ou modo offline), 
 * ele resolve a promise permitindo que a interface flua (Atualização Otimista).
 * Se a operação rejeitar imediatamente (ex: Permission Denied), ele lança o erro.
 */
export async function safeWrite(promise: Promise<any>, timeoutMs: number = 2000): Promise<void> {
  let timeoutId: any;
  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(); // Resolve otimisticamente após o timeout
    }, timeoutMs);
  });

  try {
    await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}
