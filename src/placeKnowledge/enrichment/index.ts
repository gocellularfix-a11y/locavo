/**
 * Plataforma de Enriquecimiento de Conocimiento (GEN-1 · Fase D).
 *
 * Produce PROPUESTAS a partir de hechos ya validados, con procedencia y
 * evidencia atómica heredadas, y las somete a la validación de la Fase B.
 * Nunca escribe conocimiento canónico ni resuelve precedencia.
 */
export * from './confidencePropagation';
export * from './contradictions';
export * from './enrichmentModel';
export * from './enrichmentProvider';
export * from './enrichmentSession';
export * from './entityResolution';
export * from './freshness';
export * from './normalization';
export * from './proposalIdentity';
export * from './providers/languageModelEnricher';
export * from './providers/normalizationProvider';
