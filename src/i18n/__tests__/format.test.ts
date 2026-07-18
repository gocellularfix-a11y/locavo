import {
  explainReasonsLocalized,
  formatCurrencyLocalized,
  formatDistanceLocalized,
  formatTimeLocalized,
  formatTravelTimeLocalized,
  formatVerifiedDateLocalized,
  locationFailureText,
  openStatusText,
  priceLevelText,
} from '../format';

describe('formato de hora por locale', () => {
  it('es/en usan 12 horas; de/fr/zh usan 24 horas', () => {
    expect(formatTimeLocalized('23:00', 'es')).toBe('11:00 p. m.');
    expect(formatTimeLocalized('23:00', 'en')).toBe('11:00 p. m.');
    expect(formatTimeLocalized('23:00', 'de')).toBe('23:00');
    expect(formatTimeLocalized('23:00', 'fr')).toBe('23:00');
    expect(formatTimeLocalized('23:00', 'zh-CN')).toBe('23:00');
  });
});

describe('openStatusText', () => {
  it('estado abierto con hora de cierre localizada', () => {
    expect(openStatusText({ state: 'open', closesAt: '23:00' }, 'es')).toBe(
      'Abierto hasta las 11:00 p. m.',
    );
    expect(openStatusText({ state: 'open', closesAt: '23:00' }, 'en')).toBe(
      'Open until 11:00 p. m.',
    );
    expect(openStatusText({ state: 'open', closesAt: '23:00' }, 'de')).toBe('Geöffnet bis 23:00');
  });

  it('cerrado y no confirmado', () => {
    expect(openStatusText({ state: 'closed' }, 'es')).toBe('Cerrado');
    expect(openStatusText({ state: 'unknown' }, 'en')).toBe('Hours not confirmed');
  });
});

describe('distancia por locale (km/millas)', () => {
  it('métrico: metros bajo 1 km, km con decimal', () => {
    expect(formatDistanceLocalized(0.35, 'es')).toBe('A 350 m');
    expect(formatDistanceLocalized(1.44, 'es')).toBe('A 1.4 km');
    expect(formatDistanceLocalized(1.44, 'de')).toBe('1.4 km entfernt');
  });

  it('imperial para en: millas', () => {
    expect(formatDistanceLocalized(1.609344, 'en')).toBe('1.0 mi away');
    expect(formatDistanceLocalized(0.08, 'en')).toBe('0.1 mi away');
  });

  it('tiempo aproximado', () => {
    expect(formatTravelTimeLocalized(5, 'es')).toBe('Aprox. 5 min');
    expect(formatTravelTimeLocalized(5, 'en')).toBe('About 5 min');
  });
});

describe('fechas por locale', () => {
  it('orden y meses según idioma', () => {
    expect(formatVerifiedDateLocalized('2026-07-10T18:00:00Z', 'es')).toBe(
      'Verificado el 10 jul 2026',
    );
    expect(formatVerifiedDateLocalized('2026-07-10T18:00:00Z', 'en')).toBe(
      'Verified on Jul 10, 2026',
    );
    expect(formatVerifiedDateLocalized('2026-07-10T18:00:00Z', 'zh-CN')).toBe(
      '核实于 2026年7月10日',
    );
  });

  it('fecha inválida → texto de no disponible', () => {
    expect(formatVerifiedDateLocalized('no-es-fecha', 'es')).toBe(
      'Fecha de verificación no disponible',
    );
    expect(formatVerifiedDateLocalized(undefined, 'en')).toBe('Verification date not available');
  });
});

describe('precio y fallas de ubicación', () => {
  it('niveles de precio localizados', () => {
    expect(priceLevelText(1, 'es')).toBe('Precio económico');
    expect(priceLevelText(4, 'en')).toBe('Very high price');
    expect(priceLevelText(undefined, 'es')).toBe('Precio no disponible');
  });

  it('mensajes de falla de ubicación con zona interpolada', () => {
    expect(locationFailureText('denied', 'Centro de Culiacán', 'es')).toContain(
      'Centro de Culiacán',
    );
    expect(locationFailureText('timeout', 'Tres Ríos', 'en')).toContain('Tres Ríos');
  });
});

describe('explicación de recomendación localizada', () => {
  it('usa la conjunción del idioma', () => {
    const reasons = ['OPEN_NOW', 'NEARBY', 'RECENTLY_VERIFIED'] as const;
    expect(explainReasonsLocalized([...reasons], 'es')).toBe(
      'Recomendado porque está abierto, está cerca y su información fue verificada recientemente.',
    );
    expect(explainReasonsLocalized([...reasons], 'en')).toBe(
      'Recommended because it is open, it is nearby and its information was verified recently.',
    );
    expect(explainReasonsLocalized(['OPEN_NOW'], 'zh-CN')).toBe('推荐理由：正在营业。');
  });

  it('sin razones → texto neutro', () => {
    expect(explainReasonsLocalized([], 'es')).toBe(
      'Es la opción más conveniente entre los resultados disponibles.',
    );
  });
});

describe('moneda por locale (preparación)', () => {
  it('formatea MXN sin lanzar en cualquier idioma', () => {
    for (const locale of ['es', 'en', 'zh-CN'] as const) {
      const formatted = formatCurrencyLocalized(150, 'MXN', locale);
      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted).toMatch(/150/);
    }
  });
});
