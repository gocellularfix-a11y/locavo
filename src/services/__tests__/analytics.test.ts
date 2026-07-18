import AsyncStorage from '@react-native-async-storage/async-storage';

import { createEventId, LocalAnalyticsService } from '../analytics';

describe('LocalAnalyticsService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('registra eventos con id, nombre y timestamp', async () => {
    const service = new LocalAnalyticsService();
    await service.track({
      eventName: 'navigation_requested',
      placeId: 'food-centro-01',
      navigationProvider: 'google_maps',
    });

    const events = await service.getEvents();
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.eventName).toBe('navigation_requested');
    expect(event.placeId).toBe('food-centro-01');
    expect(event.navigationProvider).toBe('google_maps');
    expect(event.eventId).toMatch(/^evt-/);
    expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false);
  });

  it('acumula eventos en orden', async () => {
    const service = new LocalAnalyticsService();
    await service.track({ eventName: 'category_selected', category: 'food' });
    await service.track({ eventName: 'search_submitted' });
    const events = await service.getEvents();
    expect(events.map((e) => e.eventName)).toEqual(['category_selected', 'search_submitted']);
  });

  it('recorta al máximo de 200 eventos', async () => {
    const service = new LocalAnalyticsService();
    for (let i = 0; i < 205; i += 1) {
      await service.track({ eventName: 'recommendation_shown', metadata: { i } });
    }
    const events = await service.getEvents();
    expect(events).toHaveLength(200);
    expect(events[events.length - 1].metadata?.i).toBe(204);
  });

  it('storage corrupto → lista vacía sin lanzar', async () => {
    await AsyncStorage.setItem('locavo.analytics.v1', '{no-es-json');
    const service = new LocalAnalyticsService();
    await expect(service.getEvents()).resolves.toEqual([]);
  });

  it('clear elimina los eventos', async () => {
    const service = new LocalAnalyticsService();
    await service.track({ eventName: 'place_opened', placeId: 'x' });
    await service.clear();
    await expect(service.getEvents()).resolves.toEqual([]);
  });
});

describe('createEventId', () => {
  it('genera ids únicos consecutivos', () => {
    const a = createEventId();
    const b = createEventId();
    expect(a).not.toBe(b);
  });
});
