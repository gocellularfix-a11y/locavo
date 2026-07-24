/**
 * POLÍTICA DE REINTENTO (GEN-1 · Fase C).
 *
 * Un transporte puede fallar de forma transitoria; el pipeline no debe caerse
 * por ello. El reintento es ACOTADO y determinista: sin aleatoriedad, sin
 * jitter y sin reloj propio. Cualquier espera se inyecta, de modo que en
 * pruebas el comportamiento es instantáneo y reproducible.
 */

export interface RetryPolicy {
  /** Intentos totales, incluido el primero. Mínimo 1. */
  readonly attempts: number;
  /** Espera inyectada entre intentos; por defecto no espera. */
  readonly delay?: (attempt: number) => Promise<void>;
  /** Decide si el fallo amerita reintento; por defecto, todos. */
  readonly shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export interface RetryOutcome<T> {
  readonly ok: boolean;
  readonly value?: T;
  readonly error?: unknown;
  /** Número de intentos realmente ejecutados. */
  readonly attempts: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = { attempts: 1 };

/**
 * Ejecuta con reintentos acotados. Nunca lanza: devuelve el resultado o el
 * último error, para que un documento problemático no interrumpa el lote.
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<RetryOutcome<T>> {
  const total = Math.max(1, Math.floor(policy.attempts));
  let lastError: unknown;

  for (let attempt = 1; attempt <= total; attempt++) {
    try {
      const value = await operation(attempt);
      return { ok: true, value, attempts: attempt };
    } catch (error) {
      lastError = error;
      const retryable = policy.shouldRetry ? policy.shouldRetry(error, attempt) : true;
      if (!retryable || attempt === total) {
        return { ok: false, error, attempts: attempt };
      }
      if (policy.delay) {
        await policy.delay(attempt);
      }
    }
  }

  return { ok: false, error: lastError, attempts: total };
}
