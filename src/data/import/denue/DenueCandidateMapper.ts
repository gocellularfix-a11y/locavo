import { isValidCoordinates } from '../../../domain/distance';
import type { LocavoCategory, PlaceAddress, PlaceContact } from '../../../domain/places/LocavoPlace';
import { normalizeText, tokenize } from '../../../utils/text';
import { categoryForScianCode } from './DenueCategoryMapping';
import type { DenueParsedRow, DenueRawRecord } from './DenueRawRecord';

/**
 * Mapper DENUE crudo → candidato de importación canónico (V4B).
 *
 * Reglas:
 *   - Identidad: `id` DENUE numérico obligatorio; el nombre original
 *     (`nom_estab`, con respaldo en `raz_social`) se conserva tal cual;
 *     el nombre normalizado se DERIVA aparte y nunca sustituye al original.
 *   - Ubicación: latitud/longitud válidas obligatorias.
 *   - Frontera del piloto: solo el municipio configurado (Culiacán =
 *     cve_ent 25 / cve_mun 006); cualquier otro registro se rechaza.
 *   - Categoría: vía la capa documentada SCIAN → Locavo; sin mapeo → rechazo.
 *   - Opcionales faltantes (teléfono, web, colonia…) NO descartan el
 *     registro: se omiten las claves vacías.
 */

export interface DenueImportCandidate {
  denueId: string;
  clee?: string;
  name: string;
  normalizedName: string;
  category: LocavoCategory;
  latitude: number;
  longitude: number;
  address: PlaceAddress;
  contact?: PlaceContact;
  searchTerms: string[];
  /** Registro original completo; se preserva como snapshot del proveedor. */
  raw: DenueRawRecord;
}

export type DenueRejectionReason =
  | 'missing_or_invalid_id'
  | 'missing_name'
  | 'unmapped_category'
  | 'invalid_coordinates'
  | 'outside_pilot_municipality';

export interface DenueRejection {
  row: number;
  denueId?: string;
  reason: DenueRejectionReason;
  /** Solo en 'unmapped_category': actividad SCIAN para reportar cobertura. */
  codigoAct?: string;
  nombreAct?: string;
}

export interface DenueMunicipalityFilter {
  cveEnt: string;
  cveMun: string;
}

/** Palabras genéricas de los nombres de actividad SCIAN (sin valor de búsqueda). */
const ACTIVITY_STOPWORDS = new Set([
  'comercio',
  'menor',
  'mayor',
  'servicio',
  'servicios',
  'preparacion',
  'otros',
  'otras',
  'otro',
  'tipo',
  'alimentos',
  'similares',
  'integrados',
  'sector',
  'privado',
  'publico',
  'para',
  'con',
  'sin',
  'llevar',
  'consumo',
  'inmediato',
  'tiendas',
]);

function clean(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function joinNonEmpty(parts: string[], separator: string): string {
  return parts.filter((p) => p.length > 0).join(separator);
}

function buildAddress(record: DenueRawRecord): PlaceAddress {
  const street = joinNonEmpty([clean(record.tipo_vial), clean(record.nom_vial)], ' ');
  const exteriorNumber = joinNonEmpty([clean(record.numero_ext), clean(record.letra_ext)], ' ');
  const neighborhood = clean(record.nomb_asent);
  const locality = clean(record.localidad);
  const formatted = joinNonEmpty(
    [joinNonEmpty([street, exteriorNumber], ' '), neighborhood, locality],
    ', ',
  );
  const address: PlaceAddress = { countryCode: 'MX' };
  if (formatted) address.formatted = formatted;
  if (street) address.street = street;
  if (exteriorNumber) address.exteriorNumber = exteriorNumber;
  if (neighborhood) address.neighborhood = neighborhood;
  const postalCode = clean(record.cod_postal);
  if (postalCode) address.postalCode = postalCode;
  if (locality) address.locality = locality;
  const municipality = clean(record.municipio);
  if (municipality) address.municipality = municipality;
  const state = clean(record.entidad);
  if (state) address.state = state;
  return address;
}

function buildContact(record: DenueRawRecord): PlaceContact | undefined {
  const contact: PlaceContact = {};
  const phone = clean(record.telefono);
  if (phone) contact.phone = phone;
  const email = clean(record.correoelec).toLowerCase();
  if (email) contact.email = email;
  const website = clean(record.www).toLowerCase();
  if (website) contact.website = /^https?:\/\//.test(website) ? website : `https://${website}`;
  return Object.keys(contact).length > 0 ? contact : undefined;
}

/** Términos de búsqueda derivados del nombre de actividad SCIAN (≤6, deterministas). */
export function buildSearchTerms(nombreAct: string): string[] {
  const terms: string[] = [];
  for (const token of tokenize(nombreAct)) {
    if (token.length >= 4 && !ACTIVITY_STOPWORDS.has(token) && !terms.includes(token)) {
      terms.push(token);
    }
    if (terms.length === 6) break;
  }
  return terms;
}

export function mapDenueRow(
  parsed: DenueParsedRow,
  municipality: DenueMunicipalityFilter,
): { candidate: DenueImportCandidate } | { rejection: DenueRejection } {
  const { row, record } = parsed;

  const denueId = clean(record.id);
  if (!/^\d+$/.test(denueId)) {
    return { rejection: { row, reason: 'missing_or_invalid_id' } };
  }

  if (clean(record.cve_ent) !== municipality.cveEnt || clean(record.cve_mun) !== municipality.cveMun) {
    return { rejection: { row, denueId, reason: 'outside_pilot_municipality' } };
  }

  // Nombre original preservado; raz_social solo como respaldo de identidad.
  const name = clean(record.nom_estab) || clean(record.raz_social);
  if (!name) {
    return { rejection: { row, denueId, reason: 'missing_name' } };
  }

  const category = categoryForScianCode(record.codigo_act);
  if (!category) {
    return {
      rejection: {
        row,
        denueId,
        reason: 'unmapped_category',
        codigoAct: clean(record.codigo_act),
        nombreAct: clean(record.nombre_act),
      },
    };
  }

  const latitude = Number.parseFloat(record.latitud);
  const longitude = Number.parseFloat(record.longitud);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !isValidCoordinates({ latitude, longitude })
  ) {
    return { rejection: { row, denueId, reason: 'invalid_coordinates' } };
  }

  const clee = clean(record.clee);
  const candidate: DenueImportCandidate = {
    denueId,
    name,
    normalizedName: normalizeText(name),
    category,
    latitude,
    longitude,
    address: buildAddress(record),
    contact: buildContact(record),
    searchTerms: buildSearchTerms(record.nombre_act),
    raw: record,
  };
  if (clee) candidate.clee = clee;
  return { candidate };
}
