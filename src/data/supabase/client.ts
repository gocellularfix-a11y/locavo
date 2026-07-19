import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import { CloudRepositoryError } from './errors';
import type { SupabaseConfig } from '../../config/supabaseConfig';

/**
 * Cliente Supabase aislado (V4A).
 *
 * - Solo este módulo y el repositorio cloud conocen supabase-js; la UI,
 *   los hooks y PlaceSearchService jamás lo importan.
 * - Sin autenticación en V4A: la sesión no se persiste ni se refresca
 *   (Locavo no tiene cuentas todavía).
 * - Nunca se registran claves en logs.
 */

/** Fila que devuelven las RPC públicas, derivada de los tipos generados. */
export type PublicPlaceResult =
  Database['public']['Functions']['place_by_id']['Returns'][number];

/** Transporte estrecho que usa el repositorio (fácil de simular en pruebas). */
export interface CloudRpcTransport {
  rpc(
    fn: 'place_by_id' | 'places_nearby' | 'places_search_text' | 'places_by_category',
    params: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

export function createSupabaseClient(config: SupabaseConfig): SupabaseClient<Database> {
  if (config.status !== 'valid' || !config.url || !config.publishableKey) {
    throw new CloudRepositoryError('SUPABASE_CONFIGURATION_MISSING', config.reason);
  }
  return createClient<Database>(config.url, config.publishableKey, {
    auth: {
      // Locavo no tiene cuentas en V4A: sin sesión, sin refresh, sin storage.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createCloudTransport(config: SupabaseConfig): CloudRpcTransport {
  const client = createSupabaseClient(config);
  return {
    async rpc(fn, params) {
      const { data, error } = await client.rpc(fn, params as never);
      return { data: data as PublicPlaceResult[] | null, error };
    },
  };
}
