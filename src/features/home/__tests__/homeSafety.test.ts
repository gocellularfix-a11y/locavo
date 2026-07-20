import fs from 'node:fs';
import path from 'node:path';

import { FEATURE_FLAGS, getDataMode } from '../../../config/featureFlags';
import { CityPackRepository } from '../../../data/places/citypack/CityPackRepository';
import { createPlaceRepository } from '../../../data/places/createPlaceRepository';
import { SupabasePlaceRepository } from '../../../data/supabase/SupabasePlaceRepository';

/**
 * Guardas del milestone V4A.2 / V4C: el pulido del inicio NO toca la
 * frontera de nube. Supabase sigue apagada; la fuente activa es el city
 * pack offline (con respaldo local dentro), nunca la nube.
 */
describe('seguridad local-first del inicio (V4A.2 / V4C)', () => {
  it('Cloud permanece OFF (flag por defecto apagado)', () => {
    expect(FEATURE_FLAGS.useCloudPlaceRepository).toBe(false);
    expect(getDataMode(FEATURE_FLAGS)).not.toBe('cloud');
  });

  it('V4C: el repositorio activo por defecto es el city pack (nunca la nube)', () => {
    const repo = createPlaceRepository();
    expect(repo).toBeInstanceOf(CityPackRepository);
    expect(repo).not.toBeInstanceOf(SupabasePlaceRepository);
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
