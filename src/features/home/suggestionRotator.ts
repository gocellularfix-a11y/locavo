/**
 * Temporizador de rotación de sugerencias (V4A.2).
 *
 * Módulo puro sin React: el hook de UI lo arranca solo cuando la pantalla
 * está activa (enfocada y app en primer plano) y lo detiene al salir, por lo
 * que nunca quedan intervalos huérfanos.
 */

/** Cadencia de rotación (~3.5–4.5 s según el milestone). */
export const SUGGESTION_INTERVAL_MS = 4_000;

export interface SuggestionRotator {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

export function createSuggestionRotator(
  onAdvance: () => void,
  intervalMs: number = SUGGESTION_INTERVAL_MS,
): SuggestionRotator {
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    start() {
      if (timer === null) {
        timer = setInterval(onAdvance, intervalMs);
      }
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
    get running() {
      return timer !== null;
    },
  };
}

/** Índice circular de la siguiente sugerencia. */
export function nextSuggestionIndex(current: number, count: number): number {
  if (count <= 0) {
    return 0;
  }
  return (current + 1) % count;
}

export interface SuggestionTransition {
  /** Duración del fundido (0 = sin animación). */
  fadeMs: number;
  /** Desplazamiento vertical sutil en px (0 = sin movimiento). */
  translate: number;
  animated: boolean;
}

/** Con movimiento reducido activo, el cambio es instantáneo (sin animación). */
export function suggestionTransition(reducedMotion: boolean): SuggestionTransition {
  if (reducedMotion) {
    return { fadeMs: 0, translate: 0, animated: false };
  }
  return { fadeMs: 180, translate: 6, animated: true };
}
