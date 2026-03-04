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

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()

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
    await client.end()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
