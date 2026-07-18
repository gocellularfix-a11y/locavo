import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Analítica local de demostración.
 *
 * Los eventos se guardan ÚNICAMENTE en el dispositivo (AsyncStorage) con un
 * tope de tamaño. No se conecta ningún servicio externo y no se registran
 * datos sensibles ni coordenadas del usuario.
 */

export type AnalyticsEventName =
  | 'recommendation_shown'
  | 'place_opened'
  | 'navigation_requested'
  | 'category_selected'
  | 'search_submitted';

export interface AnalyticsEvent {
  eventId: string;
  eventName: AnalyticsEventName;
  /** ISO-8601 UTC. */
  timestamp: string;
  placeId?: string;
  category?: string;
  navigationProvider?: string;
  metadata?: Record<string, string | number | boolean>;
}

export type AnalyticsEventInput = Omit<AnalyticsEvent, 'eventId' | 'timestamp'>;

export interface AnalyticsService {
  track(event: AnalyticsEventInput): Promise<void>;
  getEvents(): Promise<AnalyticsEvent[]>;
  clear(): Promise<void>;
}

const STORAGE_KEY = 'locavo.analytics.v1';
const MAX_EVENTS = 200;

let idCounter = 0;

/** Id local único y determinista dentro de la sesión (no requiere crypto). */
export function createEventId(now: Date = new Date()): string {
  idCounter += 1;
  return `evt-${now.getTime().toString(36)}-${idCounter.toString(36)}`;
}

export class LocalAnalyticsService implements AnalyticsService {
  private queue: Promise<void> = Promise.resolve();

  track(input: AnalyticsEventInput): Promise<void> {
    // Serializa escrituras para evitar condiciones de carrera en el storage.
    this.queue = this.queue.then(() => this.append(input)).catch(() => undefined);
    return this.queue;
  }

  private async append(input: AnalyticsEventInput): Promise<void> {
    const now = new Date();
    const event: AnalyticsEvent = {
      ...input,
      eventId: createEventId(now),
      timestamp: now.toISOString(),
    };
    const events = await this.getEvents();
    events.push(event);
    const trimmed = events.slice(-MAX_EVENTS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }

  async getEvents(): Promise<AnalyticsEvent[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as AnalyticsEvent[]) : [];
    } catch {
      return [];
    }
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Inspección en desarrollo (no es una pantalla de usuario):
 * en la consola de desarrollo puede llamarse
 * `globalThis.locavoAnalytics.getEvents()` para revisar los eventos.
 */
export function exposeForDevInspection(service: AnalyticsService): void {
  if (__DEV__) {
    (globalThis as Record<string, unknown>).locavoAnalytics = service;
  }
}
