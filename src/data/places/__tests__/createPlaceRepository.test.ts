import { createPlaceRepository } from '../createPlaceRepository';
import { LocalPlaceRepository } from '../LocalPlaceRepository';
import { FEATURE_FLAGS } from '../../../config/featureFlags';
import type { SupabaseConfig } from '../../../config/supabaseConfig';
import { CloudRepositoryError } from '../../supabase/errors';
import { SupabasePlaceRepository } from '../../supabase/SupabasePlaceRepository';

const VALID_CONFIG: SupabaseConfig = {
  status: 'valid',
  url: 'https://abcdefghij.supabase.co',
  publishableKey: 'sb_publishable_0123456789abcdefghijklmn',
};

describe('createPlaceRepository (composición)', () => {
  it('por defecto (flag apagado) → LocalPlaceRepository', () => {
    expect(createPlaceRepository()).toBeInstanceOf(LocalPlaceRepository);
  });

  it('flag apagado + configuración VÁLIDA → sigue siendo local (nunca nube accidental)', () => {
    expect(createPlaceRepository(FEATURE_FLAGS, VALID_CONFIG)).toBeInstanceOf(
      LocalPlaceRepository,
    );
  });

  it('flag encendido + configuración válida → SupabasePlaceRepository', () => {
    const repo = createPlaceRepository(
      { ...FEATURE_FLAGS, useCloudPlaceRepository: true },
      VALID_CONFIG,
    );
    expect(repo).toBeInstanceOf(SupabasePlaceRepository);
  });

  it('flag encendido + configuración ausente/inválida → error controlado y diagnosticable', () => {
    for (const config of [
      { status: 'missing' as const, reason: 'sin variables' },
      { status: 'invalid' as const, reason: 'URL inválida' },
    ]) {
      try {
        createPlaceRepository({ ...FEATURE_FLAGS, useCloudPlaceRepository: true }, config);
        throw new Error('debió lanzar');
      } catch (error) {
        expect(error).toBeInstanceOf(CloudRepositoryError);
        expect((error as CloudRepositoryError).code).toBe('SUPABASE_CONFIGURATION_MISSING');
      }
    }
  });
});
