import { MAX_PHONE_DIGITS, MIN_PHONE_DIGITS, normalizePhone } from '../phonePolicy';

const NEWLINE = String.fromCharCode(10);
const NUL = String.fromCharCode(0);
const TAB = String.fromCharCode(9);

describe('normalizePhone (V5.7)', () => {
  it('formato local mexicano común → tel: canónico', () => {
    expect(normalizePhone('(667) 123-4567')).toEqual({ valid: true, target: 'tel:6671234567', reasonCode: 'ACTION_AVAILABLE' });
  });

  it('formato internacional mexicano con +', () => {
    expect(normalizePhone('+52 667 123 4567')).toEqual({ valid: true, target: 'tel:+526671234567', reasonCode: 'ACTION_AVAILABLE' });
  });

  it('separadores visuales (espacios, puntos, guiones, paréntesis) se eliminan', () => {
    expect(normalizePhone(' 667.123.4567 ').target).toBe('tel:6671234567');
    expect(normalizePhone('667-123-4567').target).toBe('tel:6671234567');
  });

  it('conserva un único + inicial', () => {
    expect(normalizePhone('+526671234567').target).toBe('tel:+526671234567');
  });

  it('valor vacío o solo espacios → ACTION_MISSING_VALUE', () => {
    expect(normalizePhone('').reasonCode).toBe('ACTION_MISSING_VALUE');
    expect(normalizePhone('   ').reasonCode).toBe('ACTION_MISSING_VALUE');
    expect(normalizePhone(undefined).reasonCode).toBe('ACTION_MISSING_VALUE');
    expect(normalizePhone(null).reasonCode).toBe('ACTION_MISSING_VALUE');
  });

  it('letras → inválido', () => {
    expect(normalizePhone('667 CALL NOW').valid).toBe(false);
    expect(normalizePhone('restaurant.com').valid).toBe(false);
  });

  it('valor con esquema tel: incrustado → inválido', () => {
    expect(normalizePhone('tel:6671234567')).toEqual({ valid: false, target: null, reasonCode: 'ACTION_INVALID_PHONE' });
  });

  it('inyección javascript: → inválido', () => {
    expect(normalizePhone('javascript:alert(1)').valid).toBe(false);
  });

  it('inyección de query string o fragmento → inválido', () => {
    expect(normalizePhone('6671234567?body=hola').valid).toBe(false);
    expect(normalizePhone('6671234567#frag').valid).toBe(false);
  });

  it('caracteres de control (salto de línea, NUL, tabulación) → inválido', () => {
    expect(normalizePhone('667123' + NEWLINE + '4567').valid).toBe(false);
    expect(normalizePhone('667123' + NUL + '4567').valid).toBe(false);
    expect(normalizePhone('667123' + TAB + '4567').valid).toBe(false);
  });

  it('+ en posición no inicial → inválido', () => {
    expect(normalizePhone('667+1234567').valid).toBe(false);
  });

  it('demasiado corto → inválido', () => {
    expect(normalizePhone('12345').valid).toBe(false); // 5 < MIN
    expect(MIN_PHONE_DIGITS).toBe(7);
  });

  it('demasiado largo → inválido', () => {
    expect(normalizePhone('1'.repeat(MAX_PHONE_DIGITS + 1)).valid).toBe(false);
    expect(MAX_PHONE_DIGITS).toBe(15);
  });

  it('límite mínimo exacto válido', () => {
    expect(normalizePhone('1234567').valid).toBe(true); // 7 dígitos
  });

  it('determinista', () => {
    expect(normalizePhone('+52 667 123 4567')).toEqual(normalizePhone('+52 667 123 4567'));
  });
});
