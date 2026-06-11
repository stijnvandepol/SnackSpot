#!/usr/bin/env node
/**
 * Simple SQL migration runner.
 * Tracks applied migrations in a _migrations table so each file runs once.
 */
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { Client } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations')

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  try {
    // Session-level advisory lock so concurrent migrate containers (rolling
    // deploys, replicas) serialize instead of racing the same migration.
    // The constant is an arbitrary fixed key shared by all runners.
    await client.query('SELECT pg_advisory_lock(427914)')

    // Create tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        name       TEXT        NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const { rows: applied } = await client.query(
      'SELECT name FROM _migrations ORDER BY name'
    )
    const appliedSet = new Set(applied.map((r) => r.name))

    // Strict naming guard: only NNN_snake_case.sql runs. This blocks stray
    // editor/sync artifacts (e.g. macOS "name 2.sql" duplicates) from being
    // applied and wedging the migration sequence.
    const MIGRATION_NAME_RE = /^\d{3}_[a-z0-9_]+\.sql$/
    const allSqlFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()
    const files = allSqlFiles.filter((f) => MIGRATION_NAME_RE.test(f))
    for (const ignored of allSqlFiles.filter((f) => !MIGRATION_NAME_RE.test(f))) {
      console.warn(`[warn]  Ignoring unexpected file in migrations dir: ${ignored}`)
    }

    // Collision guard: two migrations sharing a sequence number means the
    // intended linear order is ambiguous. We hard-fail only when at least one
    // of the colliding files is not yet applied (a genuine new mistake);
    // already-applied historical collisions are tolerated so existing
    // databases keep deploying.
    const byNumber = new Map()
    for (const file of files) {
      const num = file.slice(0, 3)
      if (!byNumber.has(num)) byNumber.set(num, [])
      byNumber.get(num).push(file)
    }
    for (const [num, group] of byNumber) {
      if (group.length > 1 && group.some((f) => !appliedSet.has(f))) {
        throw new Error(
          `Migration number ${num} is used by multiple files: ${group.join(', ')}. ` +
            `Renumber so each migration has a unique prefix.`,
        )
      }
    }

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[skip]  ${file}`)
        continue
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`[done]  ${file}`)
      } catch (err) {
        await client.query('ROLLBACK')
        throw new Error(`Migration ${file} failed: ${err.message}`)
      }
    }

    console.log('All migrations applied.')
  } finally {
    // Release the advisory lock before closing (best-effort; the lock is
    // session-scoped so it also drops on disconnect).
    await client.query('SELECT pg_advisory_unlock(427914)').catch(() => undefined)
    await client.end()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
