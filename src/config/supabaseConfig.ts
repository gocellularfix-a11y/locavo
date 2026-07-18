/**
 * Configuración de Supabase del cliente (V4A).
 *
 * Solo variables PÚBLICAS de cliente (EXPO_PUBLIC_*). La publishable key
 * está pensada para embeberse en la app y queda limitada por Row Level
 * Security; los secretos de servidor (claves administrativas, contraseñas
 * de BD, tokens de INEGI) jamás llegan a este módulo ni al bundle.
 *
 * Importante:
 * - La existencia de variables NO activa la nube: eso lo decide el
 *   feature flag `useCloudPlaceRepository` (apagado por defecto).
 * - Este módulo nunca lanza durante el arranque normal: clasifica la
 *   configuración y deja que la composición (factory) decida.
 * - Nunca imprime claves en logs.
 */

export type SupabaseConfigStatus = 'missing' | 'invalid' | 'valid';

export interface SupabaseConfig {
  status: SupabaseConfigStatus;
  url?: string;
  publishableKey?: string;
  /** Motivo técnico cuando status !== 'valid' (sin incluir valores). */
  reason?: string;
}

export interface SupabaseEnv {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

function isValidHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

/** Heurística mínima: clave no vacía y sin espacios; no se valida el contenido. */
function looksLikeKey(value: string): boolean {
  return value.length >= 20 && !/\s/.test(value);
}

export function readSupabaseConfig(
  env: SupabaseEnv = {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): SupabaseConfig {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url && !key) {
    return { status: 'missing', reason: 'EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY no están definidas' };
  }
  if (!url) {
    return { status: 'invalid', reason: 'Falta EXPO_PUBLIC_SUPABASE_URL' };
  }
  if (!key) {
    return { status: 'invalid', reason: 'Falta EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY' };
  }
  if (!isValidHttpsUrl(url)) {
    return { status: 'invalid', reason: 'EXPO_PUBLIC_SUPABASE_URL no es una URL https válida' };
  }
  if (!looksLikeKey(key)) {
    return { status: 'invalid', reason: 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY no tiene forma de clave válida' };
  }
  return { status: 'valid', url, publishableKey: key };
}
