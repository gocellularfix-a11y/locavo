import { validateWebsite } from '../urlPolicy';

const NEWLINE = String.fromCharCode(10);
const SPACE = String.fromCharCode(32);
const NUL = String.fromCharCode(0);

describe('validateWebsite (V5.7)', () => {
  it('URL HTTPS válida → destino canónico', () => {
    expect(validateWebsite('https://example.com')).toEqual({ valid: true, target: 'https://example.com', reasonCode: 'ACTION_AVAILABLE' });
  });

  it('conserva ruta, consulta y fragmento; normaliza host a minúsculas', () => {
    expect(validateWebsite('https://Example.COM/menu?x=1#a').target).toBe('https://example.com/menu?x=1#a');
  });

  it('HTTP aprobado explícitamente por política', () => {
    expect(validateWebsite('http://example.com')).toMatchObject({ valid: true, target: 'http://example.com' });
  });

  it('dominio desnudo → normalización determinista a https', () => {
    expect(validateWebsite('example.com')).toMatchObject({ valid: true, target: 'https://example.com' });
    expect(validateWebsite('sub.example.com/path').target).toBe('https://sub.example.com/path');
  });

  it('javascript: → esquema no soportado', () => {
    expect(validateWebsite('javascript:alert(1)')).toEqual({ valid: false, target: null, reasonCode: 'ACTION_UNSUPPORTED_SCHEME' });
  });

  it('data: / file: / intent: / content: / ftp: / tel: / mailto: → no soportados', () => {
    for (const url of ['data:text/html,x', 'file:///etc/passwd', 'intent://x', 'content://x', 'ftp://x.com', 'tel:123', 'mailto:a@b.com']) {
      expect(validateWebsite(url).reasonCode).toBe('ACTION_UNSUPPORTED_SCHEME');
    }
  });

  it('URL relativa al esquema (//host) → inválida', () => {
    expect(validateWebsite('//example.com')).toEqual({ valid: false, target: null, reasonCode: 'ACTION_INVALID_URL' });
  });

  it('credenciales embebidas → inválida', () => {
    expect(validateWebsite('https://user:pass@example.com').reasonCode).toBe('ACTION_INVALID_URL');
    expect(validateWebsite('https://user@example.com').reasonCode).toBe('ACTION_INVALID_URL');
  });

  it('host malformado / vacío → inválido', () => {
    expect(validateWebsite('https://').reasonCode).toBe('ACTION_INVALID_URL');
    expect(validateWebsite('https://nodot').reasonCode).toBe('ACTION_INVALID_URL'); // etiqueta única sin TLD
    expect(validateWebsite('https://-bad-.com').reasonCode).toBe('ACTION_INVALID_URL');
  });

  it('inyección de espacio o carácter de control → inválida', () => {
    expect(validateWebsite('https://exa' + SPACE + 'mple.com').reasonCode).toBe('ACTION_INVALID_URL');
    expect(validateWebsite('https://exam' + NEWLINE + 'ple.com').reasonCode).toBe('ACTION_INVALID_URL');
    expect(validateWebsite('https://exam' + NUL + 'ple.com').reasonCode).toBe('ACTION_INVALID_URL');
  });

  it('solo espacios / vacío → ACTION_MISSING_VALUE', () => {
    expect(validateWebsite('   ').reasonCode).toBe('ACTION_MISSING_VALUE');
    expect(validateWebsite('').reasonCode).toBe('ACTION_MISSING_VALUE');
    expect(validateWebsite(undefined).reasonCode).toBe('ACTION_MISSING_VALUE');
    expect(validateWebsite(null).reasonCode).toBe('ACTION_MISSING_VALUE');
  });

  it('esquema http(s) sin // → inválido', () => {
    expect(validateWebsite('https:example.com').reasonCode).toBe('ACTION_INVALID_URL');
  });

  it('puerto no numérico → inválido; puerto numérico se conserva', () => {
    expect(validateWebsite('https://example.com:abc').reasonCode).toBe('ACTION_INVALID_URL');
    expect(validateWebsite('https://example.com:8443/x').target).toBe('https://example.com:8443/x');
  });

  it('determinista', () => {
    expect(validateWebsite('https://example.com/x')).toEqual(validateWebsite('https://example.com/x'));
  });
});
