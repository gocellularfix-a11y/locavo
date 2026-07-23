import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { Linking } from 'react-native';

import type { PlaceAction } from '../../actions';
import { buildPlaceActions } from '../../actions';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import { openDirectionsFor } from '../../hooks/useDirections';
import { analytics } from '../container';
import { executePlaceAction } from '../placeActionExecutor';

const CULIACAN = { latitude: 24.8069, longitude: -107.394 };
const place = (over: Partial<LocavoPlace> = {}): LocavoPlace =>
  ({ id: 'p1', name: 'P', coordinates: CULIACAN, ...over } as unknown as LocavoPlace);

const MAPS_URL = 'https://www.google.com/maps/dir/?api=1&destination=24.8069%2C-107.394';

describe('executePlaceAction — refuse invalid/unsupported (V5.7.1)', () => {
  it('acción no disponible no ejecuta', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const out = await executePlaceAction({ type: 'WEBSITE', availability: 'INVALID', target: null, reasonCode: 'ACTION_INVALID_URL' });
    expect(out).toEqual({ opened: false, reasonCode: 'ACTION_BLOCKED' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('destino nulo no ejecuta', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const out = await executePlaceAction({ type: 'CALL', availability: 'AVAILABLE', target: null, reasonCode: 'ACTION_AVAILABLE' });
    expect(out.reasonCode).toBe('ACTION_BLOCKED');
    expect(spy).not.toHaveBeenCalled();
  });

  it('tipo de acción no soportado se rechaza (nunca abre)', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const bad = { type: 'EMAIL', availability: 'AVAILABLE', target: 'mailto:x@y.com', reasonCode: 'ACTION_AVAILABLE' } as unknown as PlaceAction;
    const out = await executePlaceAction(bad);
    expect(out.opened).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('destino de direcciones malformado se rechaza en el ejecutor', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const out = await executePlaceAction({ type: 'DIRECTIONS', availability: 'AVAILABLE', target: ',', reasonCode: 'ACTION_AVAILABLE' });
    expect(out.opened).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('ningún valor crudo llega al opener: se abre el destino normalizado', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const action = buildPlaceActions({ coordinates: CULIACAN, contact: { website: 'example.com' } }).website;
    await executePlaceAction(action);
    expect(spy).toHaveBeenCalledWith('https://example.com');
    expect(spy).not.toHaveBeenCalledWith('example.com');
  });
});

describe('direcciones enrutadas por la ÚNICA frontera (V5.7.1)', () => {
  it('openDirectionsFor abre vía el ejecutor→proveedor y conserva la analítica', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const track = jest.spyOn(analytics, 'track');
    const ok = await openDirectionsFor(place());
    expect(ok).toBe(true);
    expect(spy).toHaveBeenCalledWith(MAPS_URL);
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'navigation_requested', placeId: 'p1' }));
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'directions_opened', placeId: 'p1' }));
  });

  it('coordenadas inválidas: bloqueado antes del opener; sin directions_opened', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const track = jest.spyOn(analytics, 'track');
    const ok = await openDirectionsFor(place({ coordinates: { latitude: NaN, longitude: 0 } } as Partial<LocavoPlace>));
    expect(ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalledWith(expect.objectContaining({ eventName: 'directions_opened' }));
  });
});

describe('sin ruta de ejecución alterna (V5.7.1)', () => {
  it('.openDirections( solo se invoca desde placeActionExecutor', () => {
    const srcRoot = join(__dirname, '..', '..'); // src/
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry === '__tests__' || entry === 'node_modules') {
            continue;
          }
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry)) {
          continue;
        }
        const src = readFileSync(full, 'utf8');
        if (/\.openDirections\(/.test(src)) {
          offenders.push(full.replace(srcRoot, '').replace(/\\/g, '/'));
        }
      }
    };
    walk(srcRoot);
    // La definición vive en navigation.ts; la única llamada, en el ejecutor.
    expect(offenders.sort()).toEqual(['/services/placeActionExecutor.ts']);
  });
});
