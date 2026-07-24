/**
 * Plataforma de Adquisición de Conocimiento (GEN-1 · Fase C).
 *
 * Convierte evidencia cruda en candidatos validados. Independiente del
 * proveedor y del transporte: local-first por diseño, sin red ni disco en el
 * pipeline. Nunca escribe conocimiento canónico.
 */
export * from './acquisitionSession';
export * from './candidateBuilder';
export * from './documentIngestion';
export * from './documentNormalization';
export * from './fingerprint';
export * from './promptRegistry';
export * from './providerModel';
export * from './providerRegistry';
export * from './providers/languageModelProvider';
export * from './providers/ruleBasedExtractor';
export * from './retryPolicy';
