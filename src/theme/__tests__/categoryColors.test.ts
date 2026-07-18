import { CATEGORIES } from '../../domain/categories';
import { CATEGORY_COLORS, getCategoryVisual } from '../categoryColors';

const HEX = /^#[0-9A-F]{6}$/i;

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe('CATEGORY_COLORS', () => {
  it('cubre exactamente las 8 categorías del catálogo', () => {
    expect(Object.keys(CATEGORY_COLORS).sort()).toEqual(
      CATEGORIES.map((c) => c.id).sort(),
    );
  });

  it('todos los colores son hex válidos', () => {
    for (const palette of Object.values(CATEGORY_COLORS)) {
      expect(palette.base).toMatch(HEX);
      expect(palette.deep).toMatch(HEX);
      expect(palette.onBase).toMatch(HEX);
      expect(palette.tintDark).toMatch(HEX);
      expect(palette.tintLight).toMatch(HEX);
    }
  });

  it('cada categoría tiene un color base distinto (sistema, no repetición)', () => {
    const bases = Object.values(CATEGORY_COLORS).map((p) => p.base.toUpperCase());
    expect(new Set(bases).size).toBe(bases.length);
  });

  it('el icono contrasta con su holder en oscuro y claro (≥ 3:1)', () => {
    for (const category of CATEGORIES) {
      const dark = getCategoryVisual(category.id, 'dark');
      const light = getCategoryVisual(category.id, 'light');
      expect(contrast(dark.icon, dark.holder)).toBeGreaterThanOrEqual(3);
      expect(contrast(light.icon, light.holder)).toBeGreaterThanOrEqual(3);
    }
  });

  it('el contenido sobre el color sólido es legible (≥ 2.5:1, igual que la marca)', () => {
    for (const category of CATEGORIES) {
      const visual = getCategoryVisual(category.id, 'dark');
      expect(contrast(visual.onSolid, visual.solid)).toBeGreaterThanOrEqual(2.5);
    }
  });
});

describe('getCategoryVisual', () => {
  it('en oscuro usa base como icono y tintDark como holder', () => {
    const visual = getCategoryVisual('food', 'dark');
    expect(visual.icon).toBe(CATEGORY_COLORS.food.base);
    expect(visual.holder).toBe(CATEGORY_COLORS.food.tintDark);
  });

  it('en claro usa deep como icono y tintLight como holder', () => {
    const visual = getCategoryVisual('food', 'light');
    expect(visual.icon).toBe(CATEGORY_COLORS.food.deep);
    expect(visual.holder).toBe(CATEGORY_COLORS.food.tintLight);
  });

  it('el sólido y su contraste vienen de base/onBase', () => {
    const visual = getCategoryVisual('beer', 'light');
    expect(visual.solid).toBe(CATEGORY_COLORS.beer.base);
    expect(visual.onSolid).toBe(CATEGORY_COLORS.beer.onBase);
  });
});
