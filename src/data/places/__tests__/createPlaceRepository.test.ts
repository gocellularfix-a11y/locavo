import { CityPackRepository } from '../citypack/CityPackRepository';
import type { CityPackAssetLoader } from '../citypack/CityPackAssetLoader';
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

// Loader inyectable: evita depender del cargador de plataforma en pruebas.
const STUB_LOADER: CityPackAssetLoader = {
  async load(): Promise<string> {
    throw new Error('sin pack en prueba');
  },
};

describe('createPlaceRepository (composición V4C)', () => {
  it('por defecto (V4C) → CityPackRepository (pack oficial de Culiacán activo)', () => {
    expect(createPlaceRepository(FEATURE_FLAGS, undefined, STUB_LOADER)).toBeInstanceOf(
      CityPackRepository,
    );
  });

  it('city pack activo + configuración de Supabase VÁLIDA → sigue siendo city pack (nunca nube accidental)', () => {
    const repo = createPlaceRepository(FEATURE_FLAGS, VALID_CONFIG, STUB_LOADER);
    expect(repo).toBeInstanceOf(CityPackRepository);
    expect(repo).not.toBeInstanceOf(SupabasePlaceRepository);
  });

  it('city pack apagado + cloud apagado → LocalPlaceRepository', () => {
    const flags = { ...FEATURE_FLAGS, useCityPackRepository: false };
    // Sin EXPO_PUBLIC_USE_CITY_PACK el city pack queda inactivo.
    const previous = process.env.EXPO_PUBLIC_USE_CITY_PACK;
    delete process.env.EXPO_PUBLIC_USE_CITY_PACK;
    try {
      expect(createPlaceRepository(flags, undefined, STUB_LOADER)).toBeInstanceOf(
        LocalPlaceRepository,
      );
    } finally {
      if (previous !== undefined) {
        process.env.EXPO_PUBLIC_USE_CITY_PACK = previous;
      }
    }
  });

  it('flag cloud encendido + configuración válida → SupabasePlaceRepository', () => {
    const repo = createPlaceRepository(
      { ...FEATURE_FLAGS, useCloudPlaceRepository: true },
      VALID_CONFIG,
      STUB_LOADER,
    );
    expect(repo).toBeInstanceOf(SupabasePlaceRepository);
  });

  it('flag cloud encendido + configuración ausente/inválida → error controlado y diagnosticable', () => {
    for (const config of [
      { status: 'missing' as const, reason: 'sin variables' },
      { status: 'invalid' as const, reason: 'URL inválida' },
    ]) {
      try {
        createPlaceRepository(
          { ...FEATURE_FLAGS, useCloudPlaceRepository: true },
          config,
          STUB_LOADER,
        );
        throw new Error('debió lanzar');
      } catch (error) {
        expect(error).toBeInstanceOf(CloudRepositoryError);
        expect((error as CloudRepositoryError).code).toBe('SUPABASE_CONFIGURATION_MISSING');
      }
    }
  });
});
