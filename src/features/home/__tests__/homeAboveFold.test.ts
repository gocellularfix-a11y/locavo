import fs from 'node:fs';
import path from 'node:path';

import {
  categoryLabelMaxLines,
  CATEGORY_GRID_COLUMNS,
  CATEGORY_LABEL_LINES,
} from '../CategoryGrid';
import { FEATURE_FLAGS } from '../../../config/featureFlags';
import { CityPackRepository } from '../../../data/places/citypack/CityPackRepository';
import { createPlaceRepository } from '../../../data/places/createPlaceRepository';
import { CATEGORIES, categoryLabelKey } from '../../../domain/categories';
import { translateIn } from '../../../i18n/I18nContext';
import { SUPPORTED_LOCALES } from '../../../i18n/types';

/**
 * Reorganización del inicio: las 8 categorías primarias visibles juntas
 * (4×2) sobre el pliegue, con un hero compacto que las soporta. Las pantallas
 * .tsx no se montan en esta suite de Jest; estas guardas fijan la ESTRUCTURA
 * que hace posible el "above-the-fold" y las pruebas de dispositivo validan
 * el comportamiento visual real.
 */

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const read = (relative: string): string =>
  fs.readFileSync(path.join(ROOT, ...relative.split('/')), 'utf8');

const home = read('src/app/(tabs)/index.tsx');
const grid = read('src/features/home/CategoryGrid.tsx');
const hero = read('src/features/home/SmartHero.tsx');

describe('Home above-the-fold — retícula de categorías', () => {
  it('el catálogo tiene EXACTAMENTE 8 categorías, cada una una sola vez', () => {
    expect(CATEGORIES).toHaveLength(8);
    const ids = CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(8);
  });

  it('el orden coincide con el panel 4×2 aprobado', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual([
      'food',
      'beer',
      'coffee',
      'lodging',
      'pharmacy',
      'gas',
      'store',
      'nightlife',
    ]);
  });

  it('la retícula usa 4 columnas', () => {
    expect(CATEGORY_GRID_COLUMNS).toBe(4);
    // 8 categorías / 4 columnas = 2 filas exactas.
    expect(CATEGORIES.length / CATEGORY_GRID_COLUMNS).toBe(2);
  });

  it('Home entrega TODAS las categorías a la retícula (sin ocultar ninguna)', () => {
    expect(home).toMatch(/<CategoryGrid\s+categories=\{CATEGORIES\}/);
    // Sin recorte previo del catálogo (nada de slice/FEATURED que oculte).
    expect(home).not.toMatch(/FEATURED_COUNT/);
    expect(home).not.toMatch(/CATEGORIES\.slice/);
    expect(home).not.toMatch(/FeaturedCategoryCard/);
  });

  it('sin "ver más", carrusel ni scroll horizontal para descubrir categorías', () => {
    // Se evalúa el CÓDIGO, no los comentarios (la documentación del propio
    // componente menciona lo que evita).
    const codeOnly = (src: string): string =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const source of [home, grid]) {
      expect(codeOnly(source)).not.toMatch(/See more|Ver m[áa]s|seeMore|carousel|Carousel/i);
    }
    // La retícula se dibuja con filas flex, no con una lista desplazable ni
    // scroll horizontal (`\bhorizontal\b` evita `paddingHorizontal`).
    expect(grid).toMatch(/flexDirection:\s*'row'/);
    expect(grid).not.toMatch(/<ScrollView/);
    expect(grid).not.toMatch(/FlatList/);
    expect(codeOnly(grid)).not.toMatch(/\bhorizontal\b/);
  });

  it('las rutas de categoría NO cambian (push a /explore con category.id)', () => {
    expect(home).toMatch(/pathname:\s*'\/explore',\s*params:\s*\{\s*category:\s*category\.id\s*\}/);
    expect(home).toMatch(/eventName:\s*'category_selected',\s*category:\s*category\.id/);
  });

  it('cada baldosa tiene etiqueta de accesibilidad y límite de líneas controlado', () => {
    expect(grid).toMatch(/accessibilityRole="button"/);
    expect(grid).toMatch(/accessibilityLabel=\{t\('category\.a11y'/);
    // Máximo de líneas adaptativo por estructura de la etiqueta.
    expect(grid).toMatch(/numberOfLines=\{maxLines\}/);
    expect(grid).toMatch(/categoryLabelMaxLines\(label\)/);
    expect(CATEGORY_LABEL_LINES).toBe(2); // tope global de líneas
  });

  it('tipografía adaptativa para palabras largas sin ruptura a mitad de palabra', () => {
    // Fuente adaptativa (encoge la palabra larga a una línea) y sin guiones ni
    // cortes agresivos en Android; centrado preservado.
    expect(grid).toMatch(/adjustsFontSizeToFit/);
    expect(grid).toMatch(/minimumFontScale=\{0\.\d+\}/);
    expect(grid).toMatch(/android_hyphenationFrequency="none"/);
    expect(grid).toMatch(/textBreakStrategy="simple"/);
    expect(grid).toMatch(/textAlign:\s*'center'/);
  });

  it('objetivo táctil cómodo (≥ 44) y escala sutil al presionar', () => {
    expect(grid).toMatch(/minHeight:\s*\d{2,}/); // baldosa con altura mínima
    expect(grid).toMatch(/scale:\s*pressed\s*\?\s*0\.97/);
  });
});

describe('Home above-the-fold — etiquetas en los 7 idiomas', () => {
  it('los 7 idiomas soportados están presentes', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(7);
  });

  for (const category of CATEGORIES) {
    it(`"${category.id}" tiene etiqueta y a11y en los 7 idiomas (sin claves crudas)`, () => {
      const labelKey = categoryLabelKey(category.id);
      for (const locale of SUPPORTED_LOCALES) {
        const label = translateIn(locale, labelKey);
        expect(label.trim().length).toBeGreaterThan(0);
        expect(label).not.toBe(labelKey); // nunca expone la clave cruda
        const a11y = translateIn(locale, 'category.a11y', { label });
        expect(a11y).toContain(label);
        expect(a11y).not.toBe('category.a11y');
      }
    });
  }
});

describe('Home above-the-fold — el hero compacto conserva la inteligencia', () => {
  it('conserva encabezado, sugerencia rotativa, Sorpréndeme, búsqueda y eslogan', () => {
    expect(hero).toMatch(/home\.heroTitle/);
    expect(hero).toMatch(/getContextualSuggestions/);
    expect(hero).toMatch(/currentSuggestion/);
    expect(hero).toMatch(/<SurpriseButton/);
    expect(hero).toMatch(/<SearchField/);
    expect(hero).toMatch(/home\.tagline/);
  });

  it('la sugerencia se mantiene en UNA sola línea (hero bajo)', () => {
    expect(hero).toMatch(/numberOfLines=\{1\}/);
  });

  it('respeta el movimiento reducido (sugerencia y respiración)', () => {
    expect(hero).toMatch(/useReducedMotion/);
    expect(hero).toMatch(/breathe=\{active && !reducedMotion\}/);
  });

  it('Home sigue conectando Sorpréndeme y búsqueda del hero', () => {
    expect(home).toMatch(/<SmartHero/);
    expect(home).toMatch(/onSurprise=\{surpriseMe\}/);
    expect(home).toMatch(/onSearchSubmit=\{submitSearch\}/);
  });
});

describe('Home above-the-fold — líneas de etiqueta por estructura (7 idiomas)', () => {
  it('máximo 2 líneas y nunca menos de 1', () => {
    for (const category of CATEGORIES) {
      for (const locale of SUPPORTED_LOCALES) {
        const lines = categoryLabelMaxLines(translateIn(locale, categoryLabelKey(category.id)));
        expect(lines).toBeGreaterThanOrEqual(1);
        expect(lines).toBeLessThanOrEqual(CATEGORY_LABEL_LINES);
      }
    }
  });

  it('palabra única → 1 línea (fuente adaptativa); varias palabras → 2 líneas', () => {
    for (const category of CATEGORIES) {
      for (const locale of SUPPORTED_LOCALES) {
        const label = translateIn(locale, categoryLabelKey(category.id));
        const expected = /\s/.test(label.trim()) ? 2 : 1;
        expect(categoryLabelMaxLines(label)).toBe(expected);
      }
    }
  });

  it('casos verificados: pt "Hospedagem" en 1 línea; "Postos de gasolina" en 2', () => {
    // "Hospedagem" es una sola palabra → 1 línea (se adapta, no se parte).
    expect(categoryLabelMaxLines(translateIn('pt', 'category.lodging'))).toBe(1);
    // "Postos de gasolina" tiene espacios → 2 líneas, rompe en el espacio.
    expect(categoryLabelMaxLines(translateIn('pt', 'category.gas'))).toBe(2);
    // Alemán: las etiquetas largas son de una sola palabra → 1 línea adaptativa.
    expect(categoryLabelMaxLines(translateIn('de', 'category.gas'))).toBe(1); // Tankstellen
    expect(categoryLabelMaxLines(translateIn('de', 'category.lodging'))).toBe(1); // Unterkunft
    // Chino: sin espacios, corto → 1 línea (sin cambios).
    expect(categoryLabelMaxLines(translateIn('zh-CN', 'category.gas'))).toBe(1);
  });
});

describe('Home above-the-fold — arquitectura de datos intacta', () => {
  it('Cloud/Supabase permanece OFF', () => {
    expect(FEATURE_FLAGS.useCloudPlaceRepository).toBe(false);
  });

  it('CityPackRepository sigue siendo la fuente de datos activa', () => {
    expect(createPlaceRepository()).toBeInstanceOf(CityPackRepository);
  });
});
