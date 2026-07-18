import { parseMapMessage } from '../messages';

describe('parseMapMessage', () => {
  it('acepta select con id válido', () => {
    expect(parseMapMessage(JSON.stringify({ type: 'select', id: 'food-centro-01' }))).toEqual({
      type: 'select',
      id: 'food-centro-01',
    });
  });

  it('acepta ready y error', () => {
    expect(parseMapMessage('{"type":"ready"}')).toEqual({ type: 'ready' });
    expect(parseMapMessage('{"type":"error"}')).toEqual({ type: 'error' });
  });

  it('rechaza JSON inválido sin lanzar', () => {
    expect(parseMapMessage('{no-json')).toBeNull();
    expect(parseMapMessage('')).toBeNull();
  });

  it('rechaza tipos fuera de la allowlist', () => {
    expect(parseMapMessage('{"type":"navigate","url":"https://evil.example"}')).toBeNull();
    expect(parseMapMessage('{"type":"eval","code":"alert(1)"}')).toBeNull();
  });

  it('rechaza select sin id válido', () => {
    expect(parseMapMessage('{"type":"select"}')).toBeNull();
    expect(parseMapMessage('{"type":"select","id":42}')).toBeNull();
    expect(parseMapMessage('{"type":"select","id":""}')).toBeNull();
    expect(parseMapMessage(`{"type":"select","id":"${'x'.repeat(300)}"}`)).toBeNull();
  });

  it('rechaza estructuras que no son objeto', () => {
    expect(parseMapMessage('"select"')).toBeNull();
    expect(parseMapMessage('[1,2,3]')).toBeNull();
    expect(parseMapMessage(12 as unknown as string)).toBeNull();
    expect(parseMapMessage(null)).toBeNull();
  });

  it('rechaza cargas desproporcionadas', () => {
    const huge = `{"type":"ready","junk":"${'x'.repeat(20000)}"}`;
    expect(parseMapMessage(huge)).toBeNull();
  });
});
