/**
 * Extracción y normalización de señales OSM aprobadas (V4F-0).
 *
 * Determinista y conservador. El parser de horarios es TODO-O-NADA: si
 * cualquier parte de la expresión no es representable sin pérdida en el modelo
 * canónico `OpeningHours`, no se ingiere ningún horario. Invariante booleana:
 * ausente/unknown/unsupported/limited → `undefined`; nunca `false` inventado.
 */
import type { DayHours, OpeningHours, TimeInterval } from '../../domain/place';

/** Orden de días OSM (Mo..Su) → índice 0..6. */
const OSM_WEEKDAY: Record<string, number> = {
  Mo: 0,
  Tu: 1,
  We: 2,
  Th: 3,
  Fr: 4,
  Sa: 5,
  Su: 6,
};

/** OSM idx (0=Mo..6=Su) → índice canónico weekly (0=Su..6=Sa). */
function toCanonicalDayIndex(osmIdx: number): number {
  return (osmIdx + 1) % 7;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_TOKEN = '(?:Mo|Tu|We|Th|Fr|Sa|Su)';
const DAY_SELECTOR_RE = new RegExp(
  `^(${DAY_TOKEN}(?:-${DAY_TOKEN})?(?:,${DAY_TOKEN}(?:-${DAY_TOKEN})?)*)\\s+(.*)$`,
);

export function extractPhone(tags: Record<string, string>): string | undefined {
  const raw = tags.phone ?? tags['contact:phone'];
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function extractWebsite(tags: Record<string, string>): string | undefined {
  const raw = tags.website ?? tags['contact:website'];
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/** `yes`→true, `no`→false, cualquier otra cosa→undefined. */
export function parseYesNo(value: string | undefined): boolean | undefined {
  if (value === 'yes') {
    return true;
  }
  if (value === 'no') {
    return false;
  }
  return undefined;
}

export interface WheelchairResult {
  /** Solo `yes` ingiere (true). `no`/`limited` NO se ingieren (no dañar). */
  value?: boolean;
  diagnostic?: 'no' | 'limited';
}

export function parseWheelchair(value: string | undefined): WheelchairResult {
  if (value === 'yes') {
    return { value: true };
  }
  if (value === 'no') {
    return { diagnostic: 'no' };
  }
  if (value === 'limited') {
    return { diagnostic: 'limited' };
  }
  return {};
}

/** `delivery`: yes→true, no→false, limited/only→undefined. */
export function parseDelivery(value: string | undefined): boolean | undefined {
  if (value === 'limited' || value === 'only') {
    return undefined;
  }
  return parseYesNo(value);
}

function expandDaySelector(selector: string): number[] | null {
  const out: number[] = [];
  for (const part of selector.split(',')) {
    const range = part.split('-');
    if (range.length === 1) {
      const idx = OSM_WEEKDAY[range[0]];
      if (idx === undefined) {
        return null;
      }
      out.push(idx);
    } else if (range.length === 2) {
      const start = OSM_WEEKDAY[range[0]];
      const end = OSM_WEEKDAY[range[1]];
      if (start === undefined || end === undefined) {
        return null;
      }
      // Expansión cíclica (Sa-Su, Fr-Mo, etc.).
      let i = start;
      out.push(i);
      while (i !== end) {
        i = (i + 1) % 7;
        out.push(i);
      }
    } else {
      return null;
    }
  }
  return out;
}

function parseIntervals(rest: string): TimeInterval[] | null {
  const intervals: TimeInterval[] = [];
  for (const chunk of rest.split(',')) {
    const dash = chunk.split('-');
    if (dash.length !== 2) {
      return null;
    }
    const [open, close] = dash;
    if (!TIME_RE.test(open) || !TIME_RE.test(close)) {
      return null;
    }
    intervals.push({ open, close });
  }
  return intervals;
}

/**
 * Parser TODO-O-NADA del subconjunto soportado de `opening_hours`. Devuelve
 * `OpeningHours` o `null` si CUALQUIER componente no es representable.
 *
 * Soportado: días/rangos/listas explícitos, `HH:MM-HH:MM` (incl. cruce de
 * medianoche), múltiples intervalos, `off`/`closed`, `24/7`.
 * No mencionado → `null`; `off`/`closed` explícito → `[]`.
 */
export function parseOpeningHours(raw: string): OpeningHours | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  // Rechazo rápido de construcciones no soportadas.
  if (/["']|PH|SH|sunrise|sunset|dawn|dusk|week|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\+|\|\|/i.test(trimmed)) {
    return null;
  }

  // OSM idx 0..6 → null (no mencionado) | 'closed' | TimeInterval[].
  const perDay: (null | 'closed' | TimeInterval[])[] = [null, null, null, null, null, null, null];

  function applyClosed(days: number[]): boolean {
    for (const d of days) {
      if (Array.isArray(perDay[d])) {
        return false; // contradicción: ya tenía intervalos
      }
      perDay[d] = 'closed';
    }
    return true;
  }

  function applyIntervals(days: number[], intervals: TimeInterval[]): boolean {
    for (const d of days) {
      const cur = perDay[d];
      if (cur === 'closed') {
        return false; // contradicción: ya estaba cerrado
      }
      perDay[d] = Array.isArray(cur) ? [...cur, ...intervals] : [...intervals];
    }
    return true;
  }

  for (const rawRule of trimmed.split(';')) {
    const rule = rawRule.trim();
    if (rule.length === 0) {
      continue;
    }
    if (rule === '24/7') {
      if (!applyIntervals([0, 1, 2, 3, 4, 5, 6], [{ open: '00:00', close: '00:00' }])) {
        return null;
      }
      continue;
    }

    let days: number[] | null;
    let rest: string;
    const dayMatch = DAY_SELECTOR_RE.exec(rule);
    if (dayMatch) {
      days = expandDaySelector(dayMatch[1]);
      rest = dayMatch[2].trim();
    } else {
      // Sin selector de días: intervalos que aplican a todos los días.
      days = [0, 1, 2, 3, 4, 5, 6];
      rest = rule;
    }
    if (days === null || rest.length === 0) {
      return null;
    }

    if (rest === 'off' || rest === 'closed') {
      if (!applyClosed(days)) {
        return null;
      }
      continue;
    }

    const intervals = parseIntervals(rest);
    if (intervals === null) {
      return null;
    }
    if (!applyIntervals(days, intervals)) {
      return null;
    }
  }

  const weekly: DayHours[] = [null, null, null, null, null, null, null];
  for (let osmIdx = 0; osmIdx < 7; osmIdx++) {
    const v = perDay[osmIdx];
    const canonical = toCanonicalDayIndex(osmIdx);
    weekly[canonical] = v === null ? null : v === 'closed' ? [] : v;
  }
  return { weekly };
}
