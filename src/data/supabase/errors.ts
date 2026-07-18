/**
 * Errores neutrales de la capa cloud (V4A).
 *
 * Los códigos son internos y NO se muestran tal cual al usuario: la UI
 * presenta sus estados de error localizados existentes (i18n). Nunca se
 * incluyen claves, URLs con credenciales ni payloads sensibles.
 */

export type CloudErrorCode =
  | 'SUPABASE_CONFIGURATION_MISSING'
  | 'CLOUD_REPOSITORY_UNAVAILABLE'
  | 'CLOUD_QUERY_FAILED'
  | 'INVALID_CLOUD_RESPONSE';

export class CloudRepositoryError extends Error {
  readonly code: CloudErrorCode;

  constructor(code: CloudErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'CloudRepositoryError';
    this.code = code;
  }
}

export function isCloudRepositoryError(error: unknown): error is CloudRepositoryError {
  return error instanceof CloudRepositoryError;
}
