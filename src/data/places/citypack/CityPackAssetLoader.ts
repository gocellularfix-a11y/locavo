/**
 * Frontera de carga de recursos del city pack (V4D).
 *
 * El repositorio de runtime solo conoce esta interfaz; cada plataforma la
 * implementa con su mecanismo nativo (fetch de estáticos same-origin en
 * web, lectura de assets empaquetados en Android/iOS). Las pruebas
 * inyectan cargadores en memoria.
 */
export interface CityPackAssetLoader {
  /** Devuelve el TEXTO crudo del recurso o lanza si no existe/está dañado. */
  load(path: string): Promise<string>;
}

export class CityPackAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CityPackAssetError';
  }
}
