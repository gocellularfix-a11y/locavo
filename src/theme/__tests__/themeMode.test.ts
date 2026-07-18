import { parseThemeMode } from '../themeMode';

describe('parseThemeMode', () => {
  it('acepta los tres modos válidos', () => {
    expect(parseThemeMode('light')).toBe('light');
    expect(parseThemeMode('dark')).toBe('dark');
    expect(parseThemeMode('system')).toBe('system');
  });

  it('valores corruptos u obsoletos → null (default seguro)', () => {
    expect(parseThemeMode('LIGHT')).toBeNull();
    expect(parseThemeMode('midnight')).toBeNull();
    expect(parseThemeMode('')).toBeNull();
    expect(parseThemeMode(null)).toBeNull();
    expect(parseThemeMode(undefined)).toBeNull();
    expect(parseThemeMode(7)).toBeNull();
    expect(parseThemeMode({ mode: 'dark' })).toBeNull();
  });
});
