/**
 * Léxico de NOMBRE (V5.8) — ESTRECHO, determinista y ReDoS-safe.
 *
 * Solo coincidencia por TOKEN exacto (palabra completa) sobre el nombre
 * normalizado (reutiliza `tokenize`): sin acentos, sin substrings accidentales,
 * sin interpretación de sentimiento, sin nombres de propietario ni atributos
 * protegidos. Mapea tokens generales del dataset de Culiacán a especialidades
 * canónicas. La evidencia se marca como NAME_LEXICON (confianza más baja que un
 * campo estructurado). Extender otra ciudad es añadir DATOS, no cambiar código.
 */
import { normalizeText } from '../../utils/text';
import type { PlaceSpecialty } from './placeIntelligenceTypes';

/**
 * Tokeniza por LÍMITE de carácter no alfanumérico (V5.8.1): la puntuación y los
 * guiones separan palabras, además del espacio. Reutiliza `normalizeText`
 * (minúsculas, sin acentos). Sigue siendo coincidencia de TOKEN EXACTO — jamás
 * substring, stemming ni difuso — y es ReDoS-safe (clase de carácter simple).
 */
function lexiconTokens(name: string): Set<string> {
  const normalized = normalizeText(name);
  if (normalized.length === 0) {
    return new Set();
  }
  return new Set(normalized.split(/[^a-z0-9]+/).filter((t) => t.length > 0));
}

/** token normalizado → especialidad canónica (coincidencia exacta de palabra). */
const TOKEN_SPECIALTY: Readonly<Record<string, PlaceSpecialty>> = {
  cafe: 'COFFEE',
  cafeteria: 'COFFEE',
  coffee: 'COFFEE',
  espresso: 'ESPRESSO',
  taqueria: 'TACOS',
  tacos: 'TACOS',
  taco: 'TACOS',
  mariscos: 'SEAFOOD',
  marisqueria: 'SEAFOOD',
  farmacia: 'PHARMACY',
  botica: 'PHARMACY',
  hotel: 'LODGING',
  motel: 'LODGING',
  hospedaje: 'LODGING',
  panaderia: 'PASTRIES',
  reposteria: 'PASTRIES',
  postres: 'DESSERTS',
  heladeria: 'DESSERTS',
  nieveria: 'DESSERTS',
  asadero: 'GRILLED_MEAT',
  parrilla: 'GRILLED_MEAT',
  asada: 'GRILLED_MEAT',
  celulares: 'MOBILE_PHONES',
  celular: 'MOBILE_PHONES',
  ropa: 'CLOTHING',
  boutique: 'CLOTHING',
  abarrotes: 'GROCERIES',
  supermercado: 'GROCERIES',
};

export interface LexiconMatch {
  readonly specialty: PlaceSpecialty;
  /** Token canónico del léxico que coincidió (seguro; nunca el nombre crudo). */
  readonly token: string;
}

/**
 * Devuelve las especialidades derivadas del nombre por coincidencia de token
 * exacta, deduplicadas y en orden canónico de aparición del token en el léxico.
 */
export function matchNameLexicon(name: string): LexiconMatch[] {
  const tokens = lexiconTokens(name);
  const matches = new Map<PlaceSpecialty, string>();

  for (const token of tokens) {
    const specialty = TOKEN_SPECIALTY[token];
    if (specialty && !matches.has(specialty)) {
      matches.set(specialty, token);
    }
  }

  // Reglas combinadas acotadas (requieren dos tokens presentes).
  if (tokens.has('reparacion') && (tokens.has('celulares') || tokens.has('celular'))) {
    if (!matches.has('PHONE_REPAIR')) {
      matches.set('PHONE_REPAIR', 'reparacion');
    }
  }
  if (tokens.has('musica') && tokens.has('vivo')) {
    if (!matches.has('LIVE_MUSIC')) {
      matches.set('LIVE_MUSIC', 'musica');
    }
  }

  return [...matches.entries()]
    .map(([specialty, token]) => ({ specialty, token }))
    .sort((a, b) => (a.specialty < b.specialty ? -1 : a.specialty > b.specialty ? 1 : 0));
}
