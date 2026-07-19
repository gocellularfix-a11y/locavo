import fs from 'node:fs';
import path from 'node:path';

import { FEATURE_FLAGS, getDataMode } from '../../../config/featureFlags';
import { createPlaceRepository } from '../../../data/places/createPlaceRepository';
import { LocalPlaceRepository } from '../../../data/places/LocalPlaceRepository';

/**
 * Guardas del milestone V4A.2: el pulido del inicio NO toca la frontera de
 * datos. La nube sigue apagada y el repositorio local sigue siendo el
 * predeterminado activo.
 */
describe('seguridad local-first del inicio (V4A.2)', () => {
  it('Cloud permanece OFF (flag por defecto apagado)', () => {
    expect(FEATURE_FLAGS.useCloudPlaceRepository).toBe(false);
    expect(getDataMode(FEATURE_FLAGS)).toBe('mock');
  });

  it('LocalPlaceRepository sigue siendo el repositorio activo por defecto', () => {
    expect(createPlaceRepository()).toBeInstanceOf(LocalPlaceRepository);
  });

  it('el módulo de sorpresa no importa Supabase ni proveedores externos', () => {
    // Verificación estática: el selector depende solo del dominio canónico
    // y del contrato PlaceRepository.
    const source = fs.readFileSync(path.join(__dirname, '..', 'surprise.ts'), 'utf8');
    expect(source).not.toMatch(/supabase/i);
    expect(source).not.toMatch(/google/i);
    expect(source).not.toMatch(/denue/i);
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });
});
