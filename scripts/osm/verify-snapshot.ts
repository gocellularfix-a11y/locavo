/**
 * CLI: verifica el snapshot OSM congelado de Culiacán contra su metadata.
 *
 *   npm run osm:snapshot:verify
 *
 * No descarga nada; solo valida el input local congelado. Sale con código != 0
 * ante cualquier discrepancia. La lógica vive en
 * `src/data/osm/snapshotIntegrity.ts` (compartida con las pruebas).
 */
import { join } from 'node:path';

import { verifySnapshot } from '../../src/data/osm/snapshotIntegrity';

const metadataPath = join(process.cwd(), 'data', 'osm', 'culiacan', 'snapshot-metadata.json');
const result = verifySnapshot(metadataPath, process.cwd());

for (const [name, passed] of Object.entries(result.checks)) {
  console.log(`  ${passed ? 'OK ' : 'XX '} ${name}`);
}
console.log(`  snapshot: ${result.snapshotAbsolutePath}`);

if (!result.ok) {
  console.error('\nVerificación del snapshot OSM FALLÓ:');
  for (const err of result.errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log('\nSnapshot OSM verificado: íntegro y consistente con su metadata.');
