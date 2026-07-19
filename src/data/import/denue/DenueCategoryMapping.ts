import scianCategoryMap from '../../../../data/denue/scian-category-map.json';

import { isCategoryId } from '../../../domain/categories';
import type { LocavoCategory } from '../../../domain/places/LocavoPlace';

/**
 * Capa de mapeo de categorías DENUE → Locavo (V4B).
 *
 * La tabla vive en `data/denue/scian-category-map.json` (única fuente de
 * verdad, compartida con el script de extracción). Un `codigo_act` SCIAN
 * sin entrada en la tabla NO se importa: el piloto solo cubre las
 * categorías canónicas existentes del MVP.
 */

interface ScianMapping {
  category: string;
  label: string;
}

const MAPPINGS: Record<string, ScianMapping> = scianCategoryMap.mappings;

/** Categoría canónica para un código SCIAN, o `undefined` si no aplica. */
export function categoryForScianCode(codigoAct: string): LocavoCategory | undefined {
  const category = MAPPINGS[codigoAct.trim()]?.category;
  return category !== undefined && isCategoryId(category) ? category : undefined;
}

/** Códigos SCIAN cubiertos por el piloto (para documentación y pruebas). */
export function mappedScianCodes(): string[] {
  return Object.keys(MAPPINGS).sort();
}
