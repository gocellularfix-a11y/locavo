import { effectiveSearchCategory, searchModeOf } from '../searchMode';

describe('searchModeOf (UX-S1)', () => {
  it('sin texto → Decision Mode', () => {
    expect(searchModeOf('')).toBe('decision');
    expect(searchModeOf('   ')).toBe('decision');
  });
  it('con texto → Search Mode', () => {
    expect(searchModeOf('tacos')).toBe('search');
    expect(searchModeOf('  Walmart ')).toBe('search');
  });
});

describe('effectiveSearchCategory — búsqueda universal sin fuga de categoría', () => {
  it('Categoría → Búsqueda: al escribir, la categoría deja de filtrar (global)', () => {
    // Gasolineras + "tacos" → NO limita a gasolineras.
    expect(effectiveSearchCategory('gas', 'tacos')).toBeNull();
    // Cerveza + "coffee" → global.
    expect(effectiveSearchCategory('beer', 'coffee')).toBeNull();
  });

  it('escenarios de validación del milestone → todos globales', () => {
    expect(effectiveSearchCategory('gas', 'pharmacy')).toBeNull();
    expect(effectiveSearchCategory('lodging', 'Walmart')).toBeNull();
    expect(effectiveSearchCategory('food', 'Starbucks')).toBeNull();
  });

  it('Búsqueda → Categoría (limpiar texto): se RESTAURA la categoría en curso', () => {
    // Estado de categoría conservado; al limpiar el texto vuelve a filtrar.
    expect(effectiveSearchCategory('beer', '')).toBe('beer');
    expect(effectiveSearchCategory('gas', '   ')).toBe('gas');
  });

  it('Decision Mode sin categoría → global (sin categoría)', () => {
    expect(effectiveSearchCategory(null, '')).toBeNull();
  });

  it('cambios repetidos de categoría sin texto → cada categoría se respeta', () => {
    expect(effectiveSearchCategory('beer', '')).toBe('beer');
    expect(effectiveSearchCategory('coffee', '')).toBe('coffee');
    expect(effectiveSearchCategory('food', '')).toBe('food');
  });

  it('texto solo de espacios NO activa búsqueda (categoría preservada)', () => {
    expect(effectiveSearchCategory('pharmacy', '\t \n ')).toBe('pharmacy');
  });

  it('es puro: no muta ni depende de estado externo', () => {
    expect(effectiveSearchCategory('gas', 'tacos')).toBe(effectiveSearchCategory('gas', 'tacos'));
  });
});
