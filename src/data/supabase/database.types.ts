/**
 * Tipos de la base de datos de Locavo (Supabase/PostgreSQL).
 *
 * NOTA DE REPRODUCIBILIDAD: cuando el stack local esté disponible
 * (requiere Docker), estos tipos se regeneran con:
 *
 *   npm run db:types   →  npx supabase gen types typescript --local
 *
 * En esta máquina Docker no está instalado, por lo que este archivo está
 * escrito a mano espejando exactamente la migración
 * `supabase/migrations/*_locavo_foundation.sql`. Debe regenerarse en
 * cuanto exista un entorno con Docker y compararse contra esta versión.
 */

/** Fila jsonb que las RPCs públicas devuelven en la columna `place`. */
export type PlaceRowJson = Record<string, unknown>;

export interface PublicPlaceResult {
  place: PlaceRowJson;
  distance_m: number | null;
  total: number;
}

export interface Database {
  public: {
    Tables: {
      places: {
        Row: {
          id: string;
          name: string;
          normalized_name: string;
          category: string;
          secondary_categories: string[];
          location: unknown; // geography(Point,4326)
          address: Record<string, unknown> | null;
          contact: Record<string, unknown> | null;
          hours: Record<string, unknown> | null;
          price: Record<string, unknown> | null;
          features: Record<string, unknown> | null;
          search_terms: string[];
          verification_status: string;
          confidence: number;
          last_verified_at: string | null;
          status: string;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // el cliente público no inserta (RLS)
        Update: never; // el cliente público no actualiza (RLS)
      };
      place_source_refs: {
        Row: {
          id: string;
          place_id: string;
          source: string;
          ref_type: string;
          external_id: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
      place_provenance: {
        Row: {
          id: string;
          place_id: string;
          source: string;
          imported_at: string | null;
          updated_at: string | null;
        };
        Insert: never;
        Update: never;
      };
      place_localized_content: {
        Row: {
          id: string;
          place_id: string;
          field: string;
          language: string;
          text_value: string;
          is_original: boolean;
          source: string;
          captured_at: string;
          is_published: boolean;
        };
        Insert: never;
        Update: never;
      };
    };
    Functions: {
      place_by_id: {
        Args: { p_id: string };
        Returns: PublicPlaceResult[];
      };
      places_nearby: {
        Args: {
          p_lat: number;
          p_lng: number;
          p_radius_m: number;
          p_categories: string[] | null;
          p_open_filtering?: boolean;
          p_limit: number;
          p_offset: number;
        };
        Returns: PublicPlaceResult[];
      };
      places_search_text: {
        Args: {
          p_query: string;
          p_lat: number | null;
          p_lng: number | null;
          p_categories: string[] | null;
          p_limit: number;
          p_offset: number;
        };
        Returns: PublicPlaceResult[];
      };
      places_by_category: {
        Args: {
          p_category: string;
          p_lat: number | null;
          p_lng: number | null;
          p_limit: number;
          p_offset: number;
        };
        Returns: PublicPlaceResult[];
      };
    };
  };
}
