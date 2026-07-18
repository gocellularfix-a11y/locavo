import { translateIn } from './I18nContext';
import type { SupportedLocale } from './types';
import { formatTime12h, type OpenStatus } from '../domain/openingHours';
import type { ConfidenceLevel, PriceLevel } from '../domain/places/LocavoPlace';
import type { RecommendationReason } from '../services/places/PlaceRankingService';
import type { LocationFailureReason } from '../services/location';

/**
 * Formato local (V3): fechas, horas, distancias y textos derivados de datos
 * estructurados del dominio. El dominio nunca produce texto visible; toda
 * presentación pasa por aquí según el locale activo.
 */

/** Locales que muestran hora en formato de 12 horas. */
const TWELVE_HOUR_LOCALES: SupportedLocale[] = ['es', 'en'];

/** Locales que usan millas en lugar de kilómetros. */
const IMPERIAL_LOCALES: SupportedLocale[] = ['en'];

const KM_PER_MILE = 1.609344;

export function formatTimeLocalized(time: string, locale: SupportedLocale): string {
  return TWELVE_HOUR_LOCALES.includes(locale) ? formatTime12h(time) : time;
}

export function openStatusText(status: OpenStatus, locale: SupportedLocale): string {
  switch (status.state) {
    case 'open':
      return status.closesAt
        ? translateIn(locale, 'status.openUntil', {
            time: formatTimeLocalized(status.closesAt, locale),
          })
        : translateIn(locale, 'status.open');
    case 'closed':
      return translateIn(locale, 'status.closed');
    case 'unknown':
      return translateIn(locale, 'status.unknown');
  }
}

export function formatDistanceLocalized(distanceKm: number, locale: SupportedLocale): string {
  if (IMPERIAL_LOCALES.includes(locale)) {
    const miles = distanceKm / KM_PER_MILE;
    return translateIn(locale, 'format.distanceMi', { value: Math.max(0.1, miles).toFixed(1) });
  }
  if (distanceKm < 1) {
    const meters = Math.max(10, Math.round(distanceKm * 100) * 10);
    return translateIn(locale, 'format.distanceM', { value: meters });
  }
  return translateIn(locale, 'format.distanceKm', { value: distanceKm.toFixed(1) });
}

export function formatTravelTimeLocalized(minutes: number, locale: SupportedLocale): string {
  return translateIn(locale, 'format.travelTime', { min: minutes });
}

export function formatVerifiedDateLocalized(
  iso: string | undefined,
  locale: SupportedLocale,
): string {
  const timestamp = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(timestamp)) {
    return translateIn(locale, 'place.verifiedUnknown');
  }
  const date = new Date(timestamp);
  const months = translateIn(locale, 'format.months').split('|');
  const formatted = translateIn(locale, 'format.date', {
    day: date.getUTCDate(),
    month: months[date.getUTCMonth()] ?? String(date.getUTCMonth() + 1),
    year: date.getUTCFullYear(),
  });
  return translateIn(locale, 'place.verifiedOn', { date: formatted });
}

export function priceLevelText(
  level: PriceLevel | undefined,
  locale: SupportedLocale,
): string {
  switch (level) {
    case 1:
      return translateIn(locale, 'place.price.1');
    case 2:
      return translateIn(locale, 'place.price.2');
    case 3:
      return translateIn(locale, 'place.price.3');
    case 4:
      return translateIn(locale, 'place.price.4');
    default:
      return translateIn(locale, 'place.price.unknown');
  }
}

export function confidenceText(level: ConfidenceLevel, locale: SupportedLocale): string {
  switch (level) {
    case 'high':
      return translateIn(locale, 'confidence.high');
    case 'medium':
      return translateIn(locale, 'confidence.medium');
    case 'low':
      return translateIn(locale, 'confidence.low');
  }
}

export function locationFailureText(
  reason: LocationFailureReason,
  manualLabel: string,
  locale: SupportedLocale,
): string {
  switch (reason) {
    case 'denied':
      return translateIn(locale, 'location.failure.denied', { label: manualLabel });
    case 'services-off':
      return translateIn(locale, 'location.failure.servicesOff', { label: manualLabel });
    case 'timeout':
      return translateIn(locale, 'location.failure.timeout', { label: manualLabel });
    case 'invalid':
    case 'error':
      return translateIn(locale, 'location.failure.error', { label: manualLabel });
  }
}

/** Explicación legible de la recomendación, con conjunción propia del idioma. */
export function explainReasonsLocalized(
  reasons: RecommendationReason[],
  locale: SupportedLocale,
): string {
  if (reasons.length === 0) {
    return translateIn(locale, 'reason.fallback');
  }
  const phrases = reasons.slice(0, 3).map((reason) => translateIn(locale, `reason.${reason}`));
  const separator = translateIn(locale, 'reason.separator');
  const and = translateIn(locale, 'reason.and');
  const list =
    phrases.length === 1
      ? phrases[0]
      : `${phrases.slice(0, -1).join(separator)}${and}${phrases[phrases.length - 1]}`;
  return translateIn(locale, 'reason.template', { list });
}

/**
 * Moneda local (preparado para precios reales; sin uso visible todavía).
 * Usa Intl cuando está disponible y degrada a un formato simple.
 */
export function formatCurrencyLocalized(
  amount: number,
  currency: string,
  locale: SupportedLocale,
): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
