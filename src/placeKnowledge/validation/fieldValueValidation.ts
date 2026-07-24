/**
 * VALIDACIÓN DE VALOR POR CAMPO CANÓNICO (GEN-1 · Fase B).
 *
 * Un campo del catálogo solo admite valores de su vocabulario cerrado. Esta
 * tabla es exhaustiva por construcción: si el catálogo gana un campo y aquí no
 * se define su validador, la compilación falla. No hay ruta por la que un
 * valor entre sin comprobar.
 *
 * Puro y determinista: sin reloj, sin red, sin estado.
 */
import type { CategoryId } from '../../domain/place';
import type { KnowledgeFieldKey } from '../model/knowledgeField';
import { isClockTime, isIsoInstant } from './temporal';

export type FieldCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const OK: FieldCheck = { ok: true };
const fail = (reason: string): FieldCheck => ({ ok: false, reason });

const CATEGORY_IDS: readonly CategoryId[] = [
  'food',
  'beer',
  'coffee',
  'lodging',
  'pharmacy',
  'gas',
  'store',
  'nightlife',
];

const PARKING_KINDS: readonly string[] = ['street', 'lot', 'garage', 'valet', 'private'];

const PLACE_SOURCES: readonly string[] = [
  'locavo',
  'denue',
  'openstreetmap',
  'owner',
  'community',
  'mock',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Arreglo de cadenas no vacías, sin duplicados y en orden estable. */
function checkStringList(value: unknown, label: string): FieldCheck {
  if (!Array.isArray(value)) {
    return fail(`${label} debe ser un arreglo`);
  }
  if (value.length === 0) {
    return fail(`${label} no puede estar vacío`);
  }
  const seen = new Set<string>();
  for (const item of value) {
    if (!nonEmptyString(item)) {
      return fail(`${label} contiene un elemento vacío o no textual`);
    }
    if (seen.has(item)) {
      return fail(`${label} contiene duplicados`);
    }
    seen.add(item);
  }
  return OK;
}

function checkOptionalBooleans(value: unknown, allowed: readonly string[], label: string): FieldCheck {
  if (!isRecord(value)) {
    return fail(`${label} debe ser un objeto`);
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return fail(`${label} no declara ningún atributo`);
  }
  for (const key of keys) {
    if (!allowed.includes(key)) {
      return fail(`${label}: atributo desconocido '${key}'`);
    }
    if (typeof value[key] !== 'boolean') {
      // Tri-estado: lo desconocido se OMITE, jamás se escribe como false null.
      return fail(`${label}.${key} debe ser booleano (lo desconocido se omite)`);
    }
  }
  return OK;
}

function checkDayHours(value: unknown, label: string): FieldCheck {
  if (value === null) {
    return OK;
  }
  if (!Array.isArray(value)) {
    return fail(`${label} debe ser null o un arreglo de intervalos`);
  }
  for (const interval of value) {
    if (!isRecord(interval) || !isClockTime(interval.open) || !isClockTime(interval.close)) {
      return fail(`${label} tiene un intervalo con horas inválidas`);
    }
  }
  return OK;
}

function checkHours(value: unknown): FieldCheck {
  if (!isRecord(value) || !Array.isArray(value.weekly)) {
    return fail('hours debe tener un arreglo weekly');
  }
  if (value.weekly.length !== 7) {
    return fail('hours.weekly debe tener exactamente 7 entradas');
  }
  for (let day = 0; day < 7; day++) {
    const check = checkDayHours(value.weekly[day], `hours.weekly[${day}]`);
    if (!check.ok) {
      return check;
    }
  }
  return OK;
}

function checkHoursExceptions(value: unknown): FieldCheck {
  if (!Array.isArray(value) || value.length === 0) {
    return fail('hoursExceptions debe ser un arreglo no vacío');
  }
  for (const exception of value) {
    if (!isRecord(exception)) {
      return fail('hoursExceptions contiene un elemento no objeto');
    }
    const { startDate, endDate, kind, hours, label } = exception;
    if (!isIsoInstant(startDate) || !isIsoInstant(endDate)) {
      return fail('hoursExceptions requiere fechas ISO válidas');
    }
    if (String(endDate) < String(startDate)) {
      return fail('hoursExceptions: endDate anterior a startDate');
    }
    if (kind !== 'closed' && kind !== 'special_hours') {
      return fail('hoursExceptions.kind desconocido');
    }
    if (kind === 'closed' && hours !== undefined) {
      return fail('un cierre no puede declarar horario');
    }
    if (kind === 'special_hours') {
      if (hours === undefined) {
        return fail('special_hours requiere horario');
      }
      const check = checkDayHours(hours, 'hoursExceptions.hours');
      if (!check.ok) {
        return check;
      }
    }
    if (label !== undefined && !nonEmptyString(label)) {
      return fail('hoursExceptions.label vacío');
    }
  }
  return OK;
}

function checkLocalizedText(value: unknown): FieldCheck {
  if (!isRecord(value) || !isRecord(value.original)) {
    return fail('description requiere un texto original');
  }
  const original = value.original;
  if (!nonEmptyString(original.text)) {
    return fail('description.original.text vacío');
  }
  if (!nonEmptyString(original.language)) {
    return fail('description.original.language vacío');
  }
  if (!PLACE_SOURCES.includes(String(original.source))) {
    return fail('description.original.source desconocido');
  }
  if (!isIsoInstant(original.capturedAt)) {
    return fail('description.original.capturedAt inválido');
  }
  if (value.translations !== undefined && !isRecord(value.translations)) {
    return fail('description.translations debe ser un objeto');
  }
  return OK;
}

function checkParking(value: unknown): FieldCheck {
  if (!isRecord(value)) {
    return fail('parking debe ser un objeto');
  }
  const { available, free, kinds } = value;
  if (available !== undefined && typeof available !== 'boolean') {
    return fail('parking.available debe ser booleano');
  }
  if (free !== undefined && typeof free !== 'boolean') {
    return fail('parking.free debe ser booleano');
  }
  if (kinds !== undefined) {
    if (!Array.isArray(kinds) || kinds.length === 0) {
      return fail('parking.kinds debe ser un arreglo no vacío');
    }
    for (const kind of kinds) {
      if (!PARKING_KINDS.includes(String(kind))) {
        return fail(`parking.kinds: valor desconocido '${String(kind)}'`);
      }
    }
  }
  if (available === undefined && free === undefined && kinds === undefined) {
    return fail('parking no declara ningún atributo');
  }
  return OK;
}

function checkSocialMedia(value: unknown): FieldCheck {
  if (!isRecord(value)) {
    return fail('socialMedia debe ser un objeto');
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return fail('socialMedia vacío');
  }
  for (const key of keys) {
    if (!nonEmptyString(key) || !nonEmptyString(value[key])) {
      return fail('socialMedia tiene una entrada vacía');
    }
  }
  return OK;
}

function checkExtraCategories(value: unknown): FieldCheck {
  const list = checkStringList(value, 'extraCategories');
  if (!list.ok) {
    return list;
  }
  for (const category of value as string[]) {
    if (!CATEGORY_IDS.includes(category as CategoryId)) {
      return fail(`extraCategories: categoría fuera de la taxonomía '${category}'`);
    }
  }
  return OK;
}

function checkEstablishedYear(value: unknown): FieldCheck {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return fail('establishedYear debe ser un entero');
  }
  // Cota estructural: rechaza absurdos sin depender del reloj de la corrida.
  if (value < 1500 || value > 2200) {
    return fail('establishedYear fuera de un rango plausible');
  }
  return OK;
}

/**
 * Tabla exhaustiva campo → validador. Añadir un campo al catálogo obliga a
 * declarar aquí su validador o la compilación falla.
 */
const FIELD_VALUE_VALIDATORS: Readonly<
  Record<KnowledgeFieldKey, (value: unknown) => FieldCheck>
> = {
  hours: checkHours,
  hoursExceptions: checkHoursExceptions,
  phones: (value) => checkStringList(value, 'phones'),
  website: (value) => (nonEmptyString(value) ? OK : fail('website vacío')),
  email: (value) => (nonEmptyString(value) ? OK : fail('email vacío')),
  socialMedia: checkSocialMedia,
  services: (value) => checkStringList(value, 'services'),
  paymentMethods: (value) => checkStringList(value, 'paymentMethods'),
  accessibility: (value) =>
    checkOptionalBooleans(
      value,
      ['wheelchairAccessible', 'stepFreeEntry', 'accessibleRestroom', 'accessibleParking'],
      'accessibility',
    ),
  parking: checkParking,
  extraCategories: checkExtraCategories,
  description: checkLocalizedText,
  languages: (value) => checkStringList(value, 'languages'),
  products: (value) => checkStringList(value, 'products'),
  businessType: (value) => (nonEmptyString(value) ? OK : fail('businessType vacío')),
  establishedYear: checkEstablishedYear,
};

/** ¿Existe el campo en el catálogo canónico? */
export function isKnownKnowledgeField(field: string): field is KnowledgeFieldKey {
  return Object.prototype.hasOwnProperty.call(FIELD_VALUE_VALIDATORS, field);
}

/** Comprueba el valor contra el vocabulario cerrado de su campo. */
export function validateFieldValue(field: KnowledgeFieldKey, value: unknown): FieldCheck {
  return FIELD_VALUE_VALIDATORS[field](value);
}
