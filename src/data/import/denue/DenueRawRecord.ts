/**
 * Registro crudo DENUE (V4B).
 *
 * Espeja 1:1 una fila del CSV oficial de descarga masiva del INEGI
 * (todas las columnas son texto tal como llegan de la fuente). El registro
 * completo se conserva como snapshot en `private.provider_snapshots`; el
 * mapper canónico solo LEE de aquí, nunca muta la fuente.
 */

/** Columnas del CSV oficial DENUE (descarga masiva, 2026). */
export const DENUE_COLUMNS = [
  'id',
  'clee',
  'nom_estab',
  'raz_social',
  'codigo_act',
  'nombre_act',
  'per_ocu',
  'tipo_vial',
  'nom_vial',
  'tipo_v_e_1',
  'nom_v_e_1',
  'tipo_v_e_2',
  'nom_v_e_2',
  'tipo_v_e_3',
  'nom_v_e_3',
  'numero_ext',
  'letra_ext',
  'edificio',
  'edificio_e',
  'numero_int',
  'letra_int',
  'tipo_asent',
  'nomb_asent',
  'tipoCenCom',
  'nom_CenCom',
  'num_local',
  'cod_postal',
  'cve_ent',
  'entidad',
  'cve_mun',
  'municipio',
  'cve_loc',
  'localidad',
  'ageb',
  'manzana',
  'telefono',
  'correoelec',
  'www',
  'tipoUniEco',
  'latitud',
  'longitud',
  'fecha_alta',
] as const;

export type DenueColumn = (typeof DENUE_COLUMNS)[number];

/** Fila cruda: toda columna es texto (posiblemente vacío) de la fuente. */
export type DenueRawRecord = Record<DenueColumn, string>;

/** Fila cruda + posición (1-based, sin contar cabecera) para reportes. */
export interface DenueParsedRow {
  row: number;
  record: DenueRawRecord;
}
