import { decodeDenueBytes, detectDenueEncoding } from '../encoding';

const SAMPLE = 'id,nom_estab\n1,Café Doña Ñoña Sánchez';

describe('detectDenueEncoding', () => {
  it('BOM UTF-8 → utf8', () => {
    const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(SAMPLE, 'utf8')]);
    expect(detectDenueEncoding(bytes)).toBe('utf8');
  });

  it('UTF-8 sin BOM con acentos → utf8', () => {
    expect(detectDenueEncoding(Buffer.from(SAMPLE, 'utf8'))).toBe('utf8');
  });

  it('latin1 con acentos (é=0xE9, ñ=0xF1) → latin1', () => {
    expect(detectDenueEncoding(Buffer.from(SAMPLE, 'latin1'))).toBe('latin1');
  });

  it('solo ASCII → utf8 (decodificación equivalente)', () => {
    expect(detectDenueEncoding(Buffer.from('id,nom_estab\n1,TACOS EL GUERO', 'ascii'))).toBe('utf8');
  });
});

describe('decodeDenueBytes (acentos y ñ preservados)', () => {
  it('decodifica UTF-8 correctamente', () => {
    const { text, encoding } = decodeDenueBytes(Buffer.from(SAMPLE, 'utf8'));
    expect(encoding).toBe('utf8');
    expect(text).toContain('Café Doña Ñoña Sánchez');
  });

  it('decodifica latin1 correctamente', () => {
    const { text, encoding } = decodeDenueBytes(Buffer.from(SAMPLE, 'latin1'));
    expect(encoding).toBe('latin1');
    expect(text).toContain('Café Doña Ñoña Sánchez');
  });

  it('ambas codificaciones producen el mismo texto final', () => {
    const utf8 = decodeDenueBytes(Buffer.from(SAMPLE, 'utf8')).text;
    const latin1 = decodeDenueBytes(Buffer.from(SAMPLE, 'latin1')).text;
    expect(utf8).toBe(latin1);
  });
});
