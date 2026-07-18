import type { PriceLevel } from '../domain/place';

const MONTHS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** '2026-07-10T18:00:00Z' → 'Verificado el 10 jul 2026'. */
export function formatVerifiedDate(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return 'Fecha de verificación no disponible';
  }
  const date = new Date(timestamp);
  return `Verificado el ${date.getUTCDate()} ${MONTHS_ES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Nivel de precio legible sin símbolos crípticos. */
export function formatPriceLevel(level: PriceLevel | null): string {
  switch (level) {
    case 1:
      return 'Precio económico';
    case 2:
      return 'Precio medio';
    case 3:
      return 'Precio alto';
    default:
      return 'Precio no disponible';
  }
}
