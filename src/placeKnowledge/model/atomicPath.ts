/**
 * RUTAS ATÓMICAS (GEN-1 · Fase D) — qué partes de un valor pueden afirmarse
 * de forma INDEPENDIENTE.
 *
 * Un campo multivaluado no es una afirmación: son varias. `services:
 * ['wifi','terraza']` afirma dos cosas que pueden tener respaldo distinto, y
 * tratarlas como una sola permitiría que un elemento sin evidencia se colara
 * apoyado en la cita de otro. Este módulo enumera esos átomos con una ruta
 * canónica y estable.
 *
 * Sintaxis: `''` = el valor completo; `[x]` = elemento de lista; `.k` =
 * subcampo; `.kinds[x]` = elemento dentro de un subcampo.
 *
 * Puro y determinista: las rutas salen ordenadas, así que el mismo valor
 * produce siempre la misma enumeración.
 */
import type { KnowledgeFieldKey } from './knowledgeField';

/** Ruta que representa el valor entero (campos escalares e indivisibles). */
export const WHOLE_VALUE_PATH = '';

/** Campos cuyo valor es una lista de elementos afirmables por separado. */
const LIST_FIELDS: readonly KnowledgeFieldKey[] = [
  'phones',
  'services',
  'paymentMethods',
  'extraCategories',
  'languages',
  'products',
];

/** Campos objeto cuyos subcampos son afirmables por separado. */
const OBJECT_FIELDS: readonly KnowledgeFieldKey[] = ['accessibility', 'socialMedia'];

export function isListField(field: KnowledgeFieldKey): boolean {
  return LIST_FIELDS.includes(field);
}

export function isObjectField(field: KnowledgeFieldKey): boolean {
  return OBJECT_FIELDS.includes(field);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sorted(paths: readonly string[]): readonly string[] {
  return [...new Set(paths)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Enumera los átomos de un valor.
 *
 * `hours` es deliberadamente UN solo átomo: el horario semanal es todo o nada
 * (misma doctrina que el enriquecimiento OSM), y afirmar días sueltos con
 * evidencia parcial produciría horarios frankenstein.
 */
export function atomicPathsOf(field: KnowledgeFieldKey, value: unknown): readonly string[] {
  if (isListField(field)) {
    if (!Array.isArray(value)) {
      return [WHOLE_VALUE_PATH];
    }
    return sorted(value.map((item) => `[${String(item)}]`));
  }

  if (isObjectField(field)) {
    if (!isRecord(value)) {
      return [WHOLE_VALUE_PATH];
    }
    return sorted(Object.keys(value).map((key) => `.${key}`));
  }

  if (field === 'parking') {
    if (!isRecord(value)) {
      return [WHOLE_VALUE_PATH];
    }
    const paths: string[] = [];
    if (value.available !== undefined) {
      paths.push('.available');
    }
    if (value.free !== undefined) {
      paths.push('.free');
    }
    if (Array.isArray(value.kinds)) {
      for (const kind of value.kinds) {
        paths.push(`.kinds[${String(kind)}]`);
      }
    }
    return paths.length > 0 ? sorted(paths) : [WHOLE_VALUE_PATH];
  }

  if (field === 'hoursExceptions') {
    if (!Array.isArray(value)) {
      return [WHOLE_VALUE_PATH];
    }
    return sorted(
      value.map((exception) => {
        const record = isRecord(exception) ? exception : {};
        return `[${String(record.startDate)}/${String(record.endDate)}]`;
      }),
    );
  }

  // Escalares e indivisibles: hours, website, email, description,
  // businessType, establishedYear.
  return [WHOLE_VALUE_PATH];
}

/** ¿La ruta pertenece al conjunto de átomos de este valor? */
export function isAtomicPathOf(
  field: KnowledgeFieldKey,
  value: unknown,
  path: string,
): boolean {
  return atomicPathsOf(field, value).includes(path);
}
