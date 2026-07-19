import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Client } from 'pg';

import {
  DENUE_IMPORT_DEFAULTS,
  runDenueImport,
} from '../../src/data/import/denue/DenueImportService';
import { createPgDenueImportGateway } from './PgDenueImportGateway';

/**
 * CLI del piloto de importación DENUE Culiacán (V4B).
 *
 * Uso (con el stack Supabase local de Docker arriba):
 *   npm run denue:import
 *
 * Lee el extracto determinista versionado (data/denue/denue_culiacan_pilot.csv)
 * y lo importa vía upsert idempotente. Conexión: SOLO la base local de
 * desarrollo (postgres/postgres es la credencial pública por defecto del
 * CLI de Supabase; aquí no hay ningún secreto real).
 */

const DEFAULT_LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function main(): Promise<void> {
  const csvPath = join(__dirname, '..', '..', 'data', 'denue', 'denue_culiacan_pilot.csv');
  const csvText = readFileSync(csvPath, 'utf8');

  const client = new Client({
    connectionString: process.env.DENUE_DB_URL ?? DEFAULT_LOCAL_DB_URL,
  });
  await client.connect();
  try {
    const report = await runDenueImport(csvText, createPgDenueImportGateway(client), DENUE_IMPORT_DEFAULTS);
    const { rejections, ...summary } = report;
    console.log(JSON.stringify(summary, null, 2));
    if (rejections.length > 0) {
      console.log('rechazos:', JSON.stringify(rejections));
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Importación DENUE fallida; la transacción fue revertida.');
  console.error(error);
  process.exitCode = 1;
});
