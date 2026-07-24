/**
 * NORMALIZACIÓN DE DOCUMENTOS (GEN-1 · Fase C).
 *
 * Convierte un documento crudo en la CAPA DE TEXTO contra la que se
 * verificarán las citas. Esa capa es el documento canónico del corpus: los
 * desplazamientos de todo span indexan ESTA cadena, nunca el original.
 *
 * Determinista por construcción: sin reloj, sin red, sin dependencias. El
 * mismo insumo produce siempre exactamente el mismo texto, de modo que un
 * span sigue apuntando al mismo lugar en cualquier corrida futura.
 */

/** Entidades HTML mínimas y seguras; se resuelven de forma fija. */
const HTML_ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/** Colapsa espacios en blanco a un solo espacio y recorta los extremos. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (match) => HTML_ENTITIES[match] ?? match);
}

/**
 * HTML → texto. Elimina por completo `script` y `style` (su contenido no es
 * texto visible y citarlo sería engañoso), convierte las etiquetas en
 * separadores y colapsa el espacio.
 */
export function htmlToText(html: string): string {
  const withoutHidden = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const withoutTags = withoutHidden.replace(/<[^>]*>/g, ' ');
  return collapseWhitespace(decodeEntities(withoutTags));
}

/**
 * Markdown → texto. Retira marcadores estructurales conservando el contenido
 * legible; el texto de un enlace se conserva y su URL se descarta.
 */
export function markdownToText(markdown: string): string {
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, ' ');
  const withoutImages = withoutFences.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  const withLinkText = withoutImages.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  const withoutMarkers = withLinkText
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/[*_~`]/g, '');
  return collapseWhitespace(withoutMarkers);
}

/** Texto plano: solo se normaliza el espacio. */
export function plainToText(text: string): string {
  return collapseWhitespace(text);
}
