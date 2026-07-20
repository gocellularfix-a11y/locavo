import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..', '..');
const explore = fs.readFileSync(path.join(ROOT, 'src', 'app', '(tabs)', 'explore.tsx'), 'utf8');
const hook = fs.readFileSync(path.join(ROOT, 'src', 'hooks', 'usePlacesQuery.ts'), 'utf8');

/**
 * V4D.2 — Guardas estáticas de la virtualización de Explorar.
 * (Las pantallas .tsx no se montan en esta suite de Jest; estas guardas
 * fijan la estructura que hace posible la virtualización y las pruebas de
 * dispositivo validan el comportamiento real.)
 */
describe('Explorar virtualizado (V4D.2)', () => {
  it('usa FlatList como único scroll vertical (sin ScrollView contenedor)', () => {
    expect(explore).toMatch(/<FlatList/);
    // ScreenContainer sin scroll: la lista es el scroll de la pantalla.
    expect(explore).toMatch(/<ScreenContainer scroll=\{false\}/);
    // El único ScrollView restante es el de chips (horizontal): no anida
    // listas verticales y no derrota la virtualización.
    const scrollViews = explore.match(/<ScrollView/g) ?? [];
    expect(scrollViews.length).toBe(1);
    expect(explore).toMatch(/<ScrollView\s*\n?\s*horizontal/);
  });

  it('las tarjetas ya no se montan todas con results.map()', () => {
    expect(explore).not.toMatch(/results\s*\.slice\([^)]*\)\s*\.map\(\s*\(?scored/);
    expect(explore).toMatch(/renderItem=\{renderItem\}/);
    expect(explore).toMatch(/keyExtractor=\{keyExtractor\}/);
  });

  it('ventana de render acotada y documentada', () => {
    expect(explore).toMatch(/LIST_INITIAL_RENDER = 8/);
    expect(explore).toMatch(/LIST_BATCH_SIZE = 8/);
    expect(explore).toMatch(/LIST_WINDOW_SIZE = 7/);
    expect(explore).toMatch(/initialNumToRender=\{LIST_INITIAL_RENDER\}/);
    expect(explore).toMatch(/maxToRenderPerBatch=\{LIST_BATCH_SIZE\}/);
    expect(explore).toMatch(/windowSize=\{LIST_WINDOW_SIZE\}/);
  });

  it('claves únicas y estables por id canónico del lugar', () => {
    expect(explore).toMatch(/keyExtractor = useCallback\(\(item: ScoredPlace\) => item\.place\.id/);
  });

  it('el tope de marcadores se mantiene (≤200, DTOs ligeros regenerados)', () => {
    expect(explore).toMatch(/MAX_MAP_MARKERS = 200/);
    expect(explore).toMatch(/results\.slice\(0, MAX_MAP_MARKERS\)/);
    // DTO ligero: solo id, coordenadas y etiqueta.
    expect(explore).toMatch(/id: r\.place\.id,\s*\n\s*latitude: r\.place\.coordinates\.latitude/);
  });

  it('Cargar más sigue presente y bloqueado mientras carga', () => {
    expect(explore).toMatch(/disabled=\{loadingMore\}/);
    expect(explore).toMatch(/onPress=\{loadMore\}/);
  });

  it('el hook conserva las guardas de respuesta obsoleta y carga concurrente', () => {
    // Guardia de secuencia: una respuesta vieja no puede pisar otra consulta.
    expect(hook).toMatch(/requestSeq\.current/);
    expect(hook).toMatch(/seq === requestSeq\.current/);
    // Cargar más no dispara en paralelo ni sin cursor.
    expect(hook).toMatch(/if \(!nextCursor \|\| loadingMore \|\| status !== 'ready'\)/);
    // El anexado deduplicado es una función pura probada aparte.
    expect(hook).toMatch(/export function appendResults/);
  });
});
