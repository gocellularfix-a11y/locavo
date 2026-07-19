import { isCategoryId } from '../../../../domain/categories';
import { categoryForScianCode, mappedScianCodes } from '../DenueCategoryMapping';

describe('DenueCategoryMapping (SCIAN → Locavo)', () => {
  it('mapea los códigos SCIAN documentados a sus categorías canónicas', () => {
    expect(categoryForScianCode('722511')).toBe('food');
    expect(categoryForScianCode('722514')).toBe('food');
    expect(categoryForScianCode('722515')).toBe('coffee');
    expect(categoryForScianCode('461212')).toBe('beer');
    expect(categoryForScianCode('461211')).toBe('beer');
    expect(categoryForScianCode('722412')).toBe('nightlife');
    expect(categoryForScianCode('722411')).toBe('nightlife');
    expect(categoryForScianCode('721111')).toBe('lodging');
    expect(categoryForScianCode('721113')).toBe('lodging');
    expect(categoryForScianCode('464111')).toBe('pharmacy');
    expect(categoryForScianCode('464112')).toBe('pharmacy');
    expect(categoryForScianCode('468411')).toBe('gas');
    expect(categoryForScianCode('461110')).toBe('store');
    expect(categoryForScianCode('462111')).toBe('store');
    expect(categoryForScianCode('462112')).toBe('store');
  });

  it('tolera espacios alrededor del código', () => {
    expect(categoryForScianCode(' 722514 ')).toBe('food');
  });

  it('devuelve undefined para códigos fuera del piloto', () => {
    expect(categoryForScianCode('812110')).toBeUndefined(); // salones de belleza
    expect(categoryForScianCode('611122')).toBeUndefined(); // escuelas
    expect(categoryForScianCode('')).toBeUndefined();
    expect(categoryForScianCode('999999')).toBeUndefined();
  });

  it('toda entrada de la tabla JSON produce una categoría canónica válida', () => {
    const codes = mappedScianCodes();
    expect(codes.length).toBe(22);
    for (const code of codes) {
      const category = categoryForScianCode(code);
      expect(category).toBeDefined();
      expect(isCategoryId(category as string)).toBe(true);
    }
  });

  it('cubre las 8 categorías del MVP relevantes al piloto', () => {
    const categories = new Set(mappedScianCodes().map((c) => categoryForScianCode(c)));
    expect([...categories].sort()).toEqual(
      ['beer', 'coffee', 'food', 'gas', 'lodging', 'nightlife', 'pharmacy', 'store'].sort(),
    );
  });
});
