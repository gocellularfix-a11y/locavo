import * as fs from 'fs';
import * as path from 'path';

/**
 * Verificaciones estáticas de seguridad (V4A).
 *
 * Docker no está garantizado en el entorno, así que estas pruebas auditan
 * las migraciones y el código fuente como texto: RLS presente, cero
 * escritura pública, tablas internas sin políticas públicas y ningún
 * secreto/service_role en el cliente.
 */

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

function readMigrations(): string {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  expect(files.length).toBeGreaterThanOrEqual(1);
  return files.map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')).join('\n');
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx|js|json)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('migraciones: RLS y superficie pública', () => {
  const sql = readMigrations().toLowerCase();

  it('RLS habilitado en todas las tablas públicas y privadas', () => {
    for (const table of [
      'public.places',
      'public.place_source_refs',
      'public.place_provenance',
      'public.place_localized_content',
      'private.data_sources',
      'private.sync_runs',
      'private.sync_items',
      'private.provider_snapshots',
      'private.place_change_history',
    ]) {
      expect(sql).toContain(`alter table ${table} enable row level security`);
    }
  });

  it('las políticas públicas son solo de lectura (ninguna insert/update/delete/all)', () => {
    const policies = sql.match(/create policy[\s\S]*?;/g) ?? [];
    expect(policies.length).toBeGreaterThanOrEqual(4);
    for (const policy of policies) {
      expect(policy).toContain('for select');
      expect(policy).not.toMatch(/for (insert|update|delete|all)/);
    }
  });

  it('ninguna política usa using (true)', () => {
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/);
  });

  it('las tablas internas (private.*) no tienen ninguna política pública', () => {
    const policies = sql.match(/create policy[\s\S]*?;/g) ?? [];
    for (const policy of policies) {
      expect(policy).not.toContain('private.');
    }
    expect(sql).toContain('revoke all on schema private');
  });

  it('la lectura pública exige published y status activo', () => {
    expect(sql).toMatch(/using\s*\(\s*published and status = 'active'\s*\)/);
  });

  it('PostGIS, trigram e identidad UUID presentes', () => {
    expect(sql).toContain('create extension if not exists postgis');
    expect(sql).toContain('create extension if not exists pg_trgm');
    expect(sql).toContain('uuid primary key default gen_random_uuid()');
    expect(sql).toContain('using gist (location)');
  });

  it('referencias externas sin duplicados por fuente y nombre NO único', () => {
    expect(sql).toContain('unique (source, ref_type, external_id)');
    expect(sql).not.toMatch(/name\s+text[^,]*unique/);
  });
});

describe('cliente: cero secretos', () => {
  const files = listSourceFiles(path.join(ROOT, 'src'));

  it('service_role jamás aparece en el código del cliente', () => {
    for (const file of files) {
      if (file.endsWith('security.static.test.ts')) {
        continue;
      }
      const content = fs.readFileSync(file, 'utf8');
      expect(content.includes('service_role')).toBe(false);
      expect(content).not.toMatch(/SUPABASE_SERVICE/i);
    }
  });

  it('solo variables públicas EXPO_PUBLIC_* en la configuración', () => {
    const config = fs.readFileSync(
      path.join(ROOT, 'src', 'config', 'supabaseConfig.ts'),
      'utf8',
    );
    const envVars = config.match(/process\.env\.([A-Z_]+)/g) ?? [];
    for (const envVar of envVars) {
      expect(envVar).toContain('EXPO_PUBLIC_');
    }
  });

  it('.gitignore protege .env y conserva .env.example', () => {
    const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    expect(gitignore).toMatch(/^\.env$/m);
    expect(gitignore).toMatch(/^\.env\.\*$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });

  it('.env.example solo contiene placeholders', () => {
    const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
    expect(example).toContain('EXPO_PUBLIC_SUPABASE_URL=');
    expect(example).toContain('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=');
    expect(example).toContain('your-project-ref');
    expect(example).toContain('your_key_here');
  });

  it('el seed local está claramente marcado como demo', () => {
    const seed = fs.readFileSync(path.join(ROOT, 'supabase', 'seed.sql'), 'utf8');
    expect(seed).toContain('SOLO PARA DESARROLLO LOCAL');
    expect(seed.toLowerCase()).toContain("'mock'");
  });
});
