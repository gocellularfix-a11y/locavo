import type { Place } from '../domain/place';
import type { PlaceRepository } from '../domain/repositories';
import { MOCK_PLACES } from './places.mock';

/**
 * Repositorio de la Fase 1: sirve los datos simulados locales.
 * Mantiene la interfaz asíncrona para que un repositorio remoto futuro
 * pueda sustituirlo sin cambiar a los consumidores.
 */
export class MockPlaceRepository implements PlaceRepository {
  private readonly places: Place[];

  constructor(places: Place[] = MOCK_PLACES) {
    this.places = places;
  }

  async listPlaces(): Promise<Place[]> {
    return [...this.places];
  }

  async getPlaceById(id: string): Promise<Place | undefined> {
    return this.places.find((place) => place.id === id);
  }
}
