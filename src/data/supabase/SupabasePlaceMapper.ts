import { isValidCoordinates } from '../../domain/distance';
import { isCategoryId } from '../../domain/categories';
import type {
  LocavoPlace,
  PlaceProvenanceEntry,
  PlaceSource,
  VerificationStatus,
} from '../../domain/places/LocavoPlace';
import type { LocalizedText, TranslatedText } from '../../domain/places/LocalizedText';
import { isSupportedLocale } from '../../i18n/types';

/**
 * Mapper puro fila jsonb (RPC `place_json`) → LocavoPlace (V4A).
 *
 * Estricto en lo esencial (id, nombre, categoría, coordenadas) y tolerante
 * en lo opcional. Los datos inesperados degradan de forma segura: una fila
 * malformada produce `null` (el repositorio la descarta) en lugar de
 * romper la app. LocavoPlace sigue siendo el único modelo de dominio.
 */

const SOURCES: PlaceSource[] = ['locavo', 'denue', 'openstreetmap', 'owner', 'community', 'mock'];
const VERIFICATION_STATUSES: VerificationStatus[] = [
  'unverified',
  'source_verified',
  'community_verified',
  'owner_verified',
  'locavo_verified',
];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
    ? (value as string[])
    : undefined;
}

function parseProvenance(value: unknown): PlaceProvenanceEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: PlaceProvenanceEntry[] = [];
  for (const raw of value) {
    const record = asRecord(raw);
    const source = asString(record?.source);
    if (record && source && (SOURCES as string[]).includes(source)) {
      entries.push({
        source: source as PlaceSource,
        importedAt: asString(record.importedAt),
        updatedAt: asString(record.updatedAt),
      });
    }
  }
  return entries;
}

/** Contenido localizado: original obligatorio; traducciones opcionales. */
function parseLocalizedText(value: unknown): LocalizedText | undefined {
  const record = asRecord(value);
  const original = asRecord(record?.original);
  const text = asString(original?.text);
  const language = asString(original?.language);
  const source = asString(original?.source);
  if (!record || !original || !text || !language || !source || !(SOURCES as string[]).includes(source)) {
    return undefined;
  }
  const translationsRaw = asRecord(record.translations);
  let translations: LocalizedText['translations'];
  if (translationsRaw) {
    for (const [locale, raw] of Object.entries(translationsRaw)) {
      const entry = asRecord(raw);
      const entryText = asString(entry?.text);
      const entrySource = asString(entry?.source);
      if (
        isSupportedLocale(locale) &&
        entry &&
        entryText &&
        entrySource &&
        (SOURCES as string[]).includes(entrySource)
      ) {
        const translated: TranslatedText = {
          text: entryText,
          translatedAt: asString(entry.translatedAt) ?? '',
          source: entrySource as PlaceSource,
        };
        translations = { ...translations, [locale]: translated };
      }
    }
  }
  return {
    original: {
      text,
      language,
      source: source as PlaceSource,
      capturedAt: asString(original.capturedAt) ?? '',
    },
    translations,
  };
}

/** Convierte una fila `place` de las RPC públicas. `null` si es inutilizable. */
export function mapCloudRowToPlace(row: unknown): LocavoPlace | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

  const id = asString(record.id);
  const name = asString(record.name);
  const category = asString(record.category);
  const coordinates = asRecord(record.coordinates);
  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;

  if (
    !id ||
    !name ||
    !category ||
    !isCategoryId(category) ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !isValidCoordinates({ latitude, longitude })
  ) {
    return null;
  }

  const verification = asRecord(record.verification);
  const verificationStatus = asString(verification?.status);
  const confidenceRaw = verification?.confidence;
  const confidence =
    typeof confidenceRaw === 'number' && confidenceRaw >= 0 && confidenceRaw <= 1
      ? confidenceRaw
      : 0;

  const statusRecord = asRecord(record.status);
  const sourceRefs = asRecord(record.sourceRefs) ?? {};

  const secondary = asStringArray(record.secondaryCategories)?.filter(isCategoryId);

  return {
    id,
    sourceRefs: {
      locavoId: asString(sourceRefs.locavoId),
      denueId: asString(sourceRefs.denueId),
      clee: asString(sourceRefs.clee),
      osmId: asString(sourceRefs.osmId),
      ownerId: asString(sourceRefs.ownerId),
    },
    name,
    normalizedName: asString(record.normalizedName) ?? name.toLowerCase(),
    category,
    secondaryCategories: secondary && secondary.length > 0 ? secondary : undefined,
    coordinates: { latitude, longitude },
    address: asRecord(record.address) as LocavoPlace['address'],
    contact: asRecord(record.contact) as LocavoPlace['contact'],
    hours: asRecord(record.hours) as LocavoPlace['hours'],
    price: asRecord(record.price) as LocavoPlace['price'],
    features: asRecord(record.features) as LocavoPlace['features'],
    verification: {
      status:
        verificationStatus && (VERIFICATION_STATUSES as string[]).includes(verificationStatus)
          ? (verificationStatus as VerificationStatus)
          : 'unverified',
      confidence,
      lastVerifiedAt: asString(verification?.lastVerifiedAt),
    },
    provenance: parseProvenance(record.provenance),
    status: {
      active: statusRecord?.active === true,
      temporarilyClosed: statusRecord?.temporarilyClosed === true || undefined,
      permanentlyClosed: statusRecord?.permanentlyClosed === true || undefined,
    },
    searchTerms: asStringArray(record.searchTerms),
    content: (() => {
      const content = asRecord(record.content);
      const description = parseLocalizedText(content?.description);
      return description ? { description } : undefined;
    })(),
    createdAt: asString(record.createdAt) ?? '',
    updatedAt: asString(record.updatedAt) ?? '',
  };
}
