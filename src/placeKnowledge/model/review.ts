/**
 * HISTORIAL DE REVISIÓN (GEN-1 · Fase A) — append-only e inmutable.
 *
 * Sustituye a un estado único de revisión: el conocimiento conserva la
 * secuencia COMPLETA de decisiones humanas, nunca solo la última. Nada se
 * borra y nada se reescribe; corregir una revisión es agregar otra entrada.
 *
 * Conservar los rechazos no es un lujo de auditoría: sin memoria de rechazo,
 * la misma propuesta defectuosa vuelve a proponerse y a revisarse en cada
 * corrida y el proceso de revisión nunca converge.
 *
 * Solo estructura: quién puede revisar y bajo qué reglas pertenece a fases
 * posteriores.
 */

export type ReviewStatus = 'pending' | 'accepted' | 'rejected';

export interface ReviewEntry {
  readonly status: ReviewStatus;
  /** Identidad del revisor (persona u operador responsable). */
  readonly reviewer: string;
  /** Fecha de la decisión (ISO-8601). */
  readonly reviewedAt: string;
  /** Motivo estructurado de la decisión, especialmente en un rechazo. */
  readonly reason?: string;
  readonly notes?: string;
  /** Versión del esquema de conocimiento vigente al registrar la decisión. */
  readonly version: number;
}

/** Secuencia inmutable de decisiones, de la más antigua a la más reciente. */
export type ReviewHistory = readonly ReviewEntry[];

/**
 * Estado vigente: la última decisión registrada. Un historial vacío significa
 * que el hecho aún no ha sido revisado, jamás que fue aceptado.
 */
export function currentReviewStatus(history: ReviewHistory): ReviewStatus {
  return history.length === 0 ? 'pending' : history[history.length - 1].status;
}

/** Agrega una decisión devolviendo una copia; el historial previo queda intacto. */
export function appendReview(history: ReviewHistory, entry: ReviewEntry): ReviewHistory {
  return [...history, entry];
}
