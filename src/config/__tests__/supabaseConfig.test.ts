import { readSupabaseConfig } from '../supabaseConfig';

const VALID_URL = 'https://abcdefghij.supabase.co';
const VALID_KEY = 'sb_publishable_0123456789abcdefghijklmn';

describe('readSupabaseConfig', () => {
  it('sin variables → missing (no lanza durante el arranque)', () => {
    expect(readSupabaseConfig({}).status).toBe('missing');
  });

  it('falta la URL o la clave → invalid con motivo claro', () => {
    expect(readSupabaseConfig({ EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: VALID_KEY }).status).toBe(
      'invalid',
    );
    expect(readSupabaseConfig({ EXPO_PUBLIC_SUPABASE_URL: VALID_URL }).status).toBe('invalid');
  });

  it('URL inválida → invalid', () => {
    for (const url of ['not-a-url', 'ftp://x.supabase.co', 'http://evil.example.com']) {
      const config = readSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: url,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: VALID_KEY,
      });
      expect(config.status).toBe('invalid');
    }
  });

  it('acepta http solo para localhost (desarrollo local)', () => {
    const config = readSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: VALID_KEY,
    });
    expect(config.status).toBe('valid');
  });

  it('clave con forma inválida → invalid', () => {
    const config = readSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: VALID_URL,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'corta',
    });
    expect(config.status).toBe('invalid');
  });

  it('configuración completa → valid', () => {
    const config = readSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: VALID_URL,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: VALID_KEY,
    });
    expect(config).toEqual({ status: 'valid', url: VALID_URL, publishableKey: VALID_KEY });
  });

  it('los motivos de error nunca incluyen el valor de la clave', () => {
    const config = readSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'not-a-url',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: VALID_KEY,
    });
    expect(config.reason ?? '').not.toContain(VALID_KEY);
  });
});
