/**
 * CONTRATO de enriquecedor (PKE-0) — la interfaz que implementarán los futuros
 * alimentadores del motor (DENUE, sitios oficiales, propietarios, fuentes
 * gubernamentales…). En este milestone existe SOLO el contrato: ninguna
 * implementación.
 *
 * Doctrina (idéntica al City Pipeline): el enriquecedor es PURO y determinista.
 * La carga de insumos (archivos, extractos congelados) es una preocupación
 * inyectada por separado en su construcción; el enriquecedor jamás hace red,
 * disco ni usa reloj.
 */
import type { LocavoPlace } from '../domain/places/LocavoPlace';
import type { KnowledgeFragment } from './model/knowledgeFragment';
import type { KnowledgeSourceId } from './model/source';

export interface KnowledgeEnricher {
  /** Fuente registrada que emite los fragmentos de este enriquecedor. */
  readonly sourceId: KnowledgeSourceId;
  /**
   * Lugar canónico + insumos precargados → fragmentos. Mismo lugar y mismos
   * insumos → mismos fragmentos, byte a byte.
   */
  enrich(place: LocavoPlace): readonly KnowledgeFragment[];
}
