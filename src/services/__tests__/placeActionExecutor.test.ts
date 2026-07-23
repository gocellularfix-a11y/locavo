import { Linking } from 'react-native';

import type { PlaceAction } from '../../actions';
import { executePlaceAction } from '../placeActionExecutor';

const action = (over: Partial<PlaceAction>): PlaceAction => ({
  type: 'WEBSITE',
  availability: 'AVAILABLE',
  target: 'https://example.com',
  reasonCode: 'ACTION_AVAILABLE',
  ...over,
});

describe('executePlaceAction (V5.7) — frontera de ejecución', () => {
  it('acción no disponible no se ejecuta', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const out = await executePlaceAction(action({ availability: 'INVALID', target: null }));
    expect(out).toEqual({ opened: false, reasonCode: 'ACTION_BLOCKED' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('destino nulo no se ejecuta', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const out = await executePlaceAction(action({ availability: 'AVAILABLE', target: null }));
    expect(out.opened).toBe(false);
    expect(out.reasonCode).toBe('ACTION_BLOCKED');
    expect(spy).not.toHaveBeenCalled();
  });

  it('acción de llamada válida llega al opener con el tel: canónico', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const out = await executePlaceAction(action({ type: 'CALL', target: 'tel:6671234567' }));
    expect(out).toEqual({ opened: true, reasonCode: 'ACTION_OPENED' });
    expect(spy).toHaveBeenCalledWith('tel:6671234567');
  });

  it('acción de sitio web válida llega al opener con el destino validado (no crudo)', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const out = await executePlaceAction(action({ type: 'WEBSITE', target: 'https://example.com/menu' }));
    expect(out.opened).toBe(true);
    expect(spy).toHaveBeenCalledWith('https://example.com/menu');
    // El opener nunca recibe un valor crudo inseguro.
    expect(spy).not.toHaveBeenCalledWith(expect.stringMatching(/^javascript:/));
  });

  it('direcciones válidas usan el proveedor de mapas aprobado', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const out = await executePlaceAction(action({ type: 'DIRECTIONS', target: '24.8069,-107.394' }));
    expect(out.opened).toBe(true);
    expect(spy).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=24.8069%2C-107.394');
  });

  it('rechazo del opener se maneja de forma segura (no truena)', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const out = await executePlaceAction(action({ type: 'CALL', target: 'tel:6671234567' }));
    expect(out).toEqual({ opened: false, reasonCode: 'ACTION_OPEN_FAILED' });
  });

  it('fallo del opener no propaga excepción', async () => {
    jest.spyOn(Linking, 'openURL').mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(executePlaceAction(action({ type: 'WEBSITE', target: 'https://example.com' }))).resolves.toEqual({
      opened: false,
      reasonCode: 'ACTION_OPEN_FAILED',
    });
  });
});
