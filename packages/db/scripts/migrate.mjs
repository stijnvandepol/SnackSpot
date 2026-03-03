import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const migrationsDir = path.resolve(process.cwd(), 'migrations');
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

const client = new Client({ connectionString: databaseUrl });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

for (const file of files) {
  const existing = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
  if (existing.rowCount) continue;
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`Applied migration ${file}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

await client.end();
console.log('Migrations complete');
