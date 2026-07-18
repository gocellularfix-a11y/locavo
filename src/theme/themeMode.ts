export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Valida una preferencia de tema persistida. Cualquier valor corrupto,
 * obsoleto o de tipo inesperado degrada al default seguro (`system`
 * expresado como null → el llamador conserva su estado inicial).
 */
export function parseThemeMode(raw: unknown): ThemeMode | null {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : null;
}
