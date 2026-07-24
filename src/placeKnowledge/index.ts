/**
 * Place Knowledge Engine — punto de entrada público.
 *
 * PKE-0: modelo canónico de hechos con evidencia, fuente, confianza y licencia.
 * GEN-1 · Fase A: span de evidencia, metadatos de adquisición, versión de
 * validador e historial de revisión append-only.
 *
 * Arquitectura: docs/architecture/PLACE-KNOWLEDGE-ENGINE.md
 */
export * from './enricherContract';
export * from './model/acquisition';
export * from './model/confidence';
export * from './model/coverage';
export * from './model/evidence';
export * from './model/evidenceSpan';
export * from './model/hoursException';
export * from './model/knowledgeField';
export * from './model/knowledgeFragment';
export * from './model/placeKnowledge';
export * from './model/precedence';
export * from './model/review';
export * from './model/serialization';
export * from './model/source';
export * from './acquisition';
export * from './enrichment';
export * from './validation';
