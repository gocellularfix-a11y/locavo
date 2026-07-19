/**
 * Resolución de la raíz de datos GeoData (V4C).
 *
 * El archivo nacional DENUE vive FUERA del repositorio, en una raíz
 * configurable. Nunca se asume una letra de unidad: la raíz llega por
 * argumento CLI (`--data-root <ruta>`) o por la variable de entorno
 * `LOCAVO_GEODATA_DIR`. Rutas de Windows con espacios y comillas
 * envolventes se manejan correctamente.
 */

export const GEODATA_ENV_VAR = 'LOCAVO_GEODATA_DIR';
export const GEODATA_CLI_FLAG = '--data-root';

export class GeoDataRootError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeoDataRootError';
  }
}

/** Quita comillas envolventes ("..." o '...') y espacios sobrantes. */
function unquote(value: string): string {
  const trimmed = value.trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if (trimmed.length >= 2 && first === last && (first === '"' || first === "'")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/** Normaliza separadores finales sin tocar el resto de la ruta. */
function stripTrailingSeparators(value: string): string {
  return value.replace(/[\\/]+$/, '') || value;
}

/**
 * Resuelve la raíz GeoData. Precedencia: CLI (`--data-root X` o
 * `--data-root=X`) sobre la variable de entorno. Sin ninguna de las dos,
 * lanza un error con instrucciones claras (no hay default de máquina).
 */
export function resolveGeoDataRoot(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): string {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === GEODATA_CLI_FLAG) {
      const next = argv[i + 1];
      if (next === undefined || unquote(next).length === 0) {
        throw new GeoDataRootError(`${GEODATA_CLI_FLAG} requiere una ruta, por ejemplo: ${GEODATA_CLI_FLAG} "D:\\GeoData"`);
      }
      return stripTrailingSeparators(unquote(next));
    }
    if (arg.startsWith(`${GEODATA_CLI_FLAG}=`)) {
      const value = unquote(arg.slice(GEODATA_CLI_FLAG.length + 1));
      if (value.length === 0) {
        throw new GeoDataRootError(`${GEODATA_CLI_FLAG}= requiere una ruta no vacía`);
      }
      return stripTrailingSeparators(value);
    }
  }

  const fromEnv = env[GEODATA_ENV_VAR];
  if (fromEnv !== undefined && unquote(fromEnv).length > 0) {
    return stripTrailingSeparators(unquote(fromEnv));
  }

  throw new GeoDataRootError(
    `Raíz GeoData no configurada. Usa ${GEODATA_CLI_FLAG} "<ruta>\\GeoData" o define ${GEODATA_ENV_VAR}. ` +
      'El archivo oficial DENUE nunca vive dentro del repositorio.',
  );
}
