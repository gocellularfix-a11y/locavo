import { validateWebsite } from '../urlPolicy';

const cc = String.fromCharCode;
const C1 = cc(0x85); // NEL (C1 control)
const LS = cc(0x2028); // line separator
const PS = cc(0x2029); // paragraph separator
const ZWSP = cc(0x200b); // zero-width space
const ZWNJ = cc(0x200c);
const LRM = cc(0x200e); // left-to-right mark
const WJ = cc(0x2060); // word joiner
const BOM = cc(0xfeff); // byte-order mark / ZWNBSP
const NBSP = cc(0xa0); // no-break space

describe('validateWebsite — port policy (V5.7.1)', () => {
  it('puerto 65535 aceptado', () => {
    expect(validateWebsite('https://ok.com:65535/x')).toMatchObject({ valid: true, target: 'https://ok.com:65535/x' });
  });
  it('puerto 0 aceptado', () => {
    expect(validateWebsite('https://ok.com:0').valid).toBe(true);
  });
  it('puerto 65536 rechazado', () => {
    expect(validateWebsite('https://ok.com:65536').reasonCode).toBe('ACTION_INVALID_URL');
  });
  it('puerto 70000 rechazado', () => {
    expect(validateWebsite('https://ok.com:70000').reasonCode).toBe('ACTION_INVALID_URL');
  });
  it('puerto 99999 rechazado', () => {
    expect(validateWebsite('https://ok.com:99999').reasonCode).toBe('ACTION_INVALID_URL');
  });
  it('puerto no numérico rechazado', () => {
    expect(validateWebsite('https://ok.com:abc').reasonCode).toBe('ACTION_INVALID_URL');
    expect(validateWebsite('https://ok.com:12a').reasonCode).toBe('ACTION_INVALID_URL');
  });
  it('dos puntos sin puerto rechazado', () => {
    expect(validateWebsite('https://ok.com:').reasonCode).toBe('ACTION_INVALID_URL');
  });
});

describe('validateWebsite — Unicode/invisibles (V5.7.1)', () => {
  it('esquemas soportados en mayúsculas se normalizan y aceptan', () => {
    expect(validateWebsite('HTTPS://Example.COM/A').target).toBe('https://example.com/A');
    expect(validateWebsite('HtTp://Example.com').target).toBe('http://example.com');
  });

  it('controles C1 rechazados', () => {
    expect(validateWebsite('https://exa' + C1 + 'mple.com').reasonCode).toBe('ACTION_INVALID_URL');
  });
  it('separador de línea (U+2028) rechazado', () => {
    expect(validateWebsite('https://example.com/a' + LS + 'b').reasonCode).toBe('ACTION_INVALID_URL');
  });
  it('separador de párrafo (U+2029) rechazado', () => {
    expect(validateWebsite('https://example.com/a' + PS + 'b').reasonCode).toBe('ACTION_INVALID_URL');
  });
  it('caracteres de ancho cero rechazados (interior y extremos)', () => {
    expect(validateWebsite('https://exa' + ZWSP + 'mple.com').reasonCode).toBe('ACTION_INVALID_URL');
    expect(validateWebsite('https://example.com' + ZWNJ).reasonCode).toBe('ACTION_INVALID_URL');
    expect(validateWebsite('https://example.com/a' + LRM + 'b').reasonCode).toBe('ACTION_INVALID_URL');
    expect(validateWebsite('https://example.com/a' + WJ + 'b').reasonCode).toBe('ACTION_INVALID_URL');
  });
  it('BOM rechazado en cualquier posición (no se "limpia" en los extremos)', () => {
    expect(validateWebsite('https://example.com/' + BOM).reasonCode).toBe('ACTION_INVALID_URL');
    expect(validateWebsite(BOM + 'https://example.com').reasonCode).toBe('ACTION_INVALID_URL');
    expect(validateWebsite('https://exa' + BOM + 'mple.com').reasonCode).toBe('ACTION_INVALID_URL');
  });
  it('NBSP rechazado en cualquier posición', () => {
    expect(validateWebsite('https://example.com/' + NBSP).reasonCode).toBe('ACTION_INVALID_URL');
    expect(validateWebsite('https://exa' + NBSP + 'mple.com').reasonCode).toBe('ACTION_INVALID_URL');
  });

  it('texto internacional visible legítimo se conserva cuando es seguro', () => {
    expect(validateWebsite('https://example.com/café/menú').valid).toBe(true);
    expect(validateWebsite('https://example.com/día').target).toBe('https://example.com/día');
  });
  it('espacios ASCII en los extremos se recortan y aceptan; internos invalidan', () => {
    expect(validateWebsite('  https://ok.com  ').target).toBe('https://ok.com');
    expect(validateWebsite('https://ex ample.com').reasonCode).toBe('ACTION_INVALID_URL');
  });
});
