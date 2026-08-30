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
