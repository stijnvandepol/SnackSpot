#!/usr/bin/env node
/**
 * Seed script - creates demo data for local development.
 * Run after migrations: pnpm --filter @snackspot/db seed
 */
import pg from 'pg'

// In production the API hashes with argon2id.
// Seed users use a fixed argon2id hash for "Password1!".
const DEMO_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$RpMBYBpWDg1mCmMEKiRHOg'

const { Client } = pg

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  try {
    await client.query(`
      INSERT INTO users (id, email, username, password_hash, role)
      VALUES
        ('user_admin_01', 'admin@snackspot.local', 'admin', $1, 'ADMIN'),
        ('user_mod_01',   'mod@snackspot.local',   'mod',   $1, 'MODERATOR'),
        ('user_test_01',  'alice@example.com',     'alice', $1, 'USER'),
        ('user_test_02',  'bob@example.com',       'bob',   $1, 'USER')
      ON CONFLICT (id) DO NOTHING
    `, [DEMO_PASSWORD_HASH])

    await client.query(`
      INSERT INTO places (id, name, address, location)
      VALUES
        ('place_01', 'Stroopwafel Street',  'Stroopwafelstraat 1, Amsterdam',
         ST_SetSRID(ST_MakePoint(4.9041, 52.3676), 4326)::geography),
        ('place_02', 'Herring Harbor',      'Haringkade 10, Amsterdam',
         ST_SetSRID(ST_MakePoint(4.9102, 52.3720), 4326)::geography),
        ('place_03', 'Bitterballen Bros',   'Bitterballenplein 5, Amsterdam',
         ST_SetSRID(ST_MakePoint(4.8985, 52.3640), 4326)::geography)
      ON CONFLICT (id) DO NOTHING
    `)

    await client.query(`
      INSERT INTO reviews (id, user_id, place_id, rating, text, dish_name, status)
      VALUES
        ('rev_01', 'user_test_01', 'place_01', 5,
         'Best stroopwafels in Amsterdam! Crispy, warm, and perfectly sweet.',
         'Stroopwafel', 'PUBLISHED'),
        ('rev_02', 'user_test_02', 'place_01', 4,
         'Really good but the queue was long. Worth the wait though.',
         'Mini Stroopwafel', 'PUBLISHED'),
        ('rev_03', 'user_test_01', 'place_02', 5,
         'Fresh herring from the bucket, just like oma used to make.',
         'Hollandse Nieuwe', 'PUBLISHED'),
        ('rev_04', 'user_test_02', 'place_03', 4,
         'Crunchy bitterballen, great mustard dip. Perfect biersnack.',
         'Bitterballen', 'PUBLISHED')
      ON CONFLICT (id) DO NOTHING
    `)

    console.log('Seed complete.')
    console.log()
    console.log('Demo accounts (password: Password1!):')
    console.log('  admin@snackspot.local  (admin)')
    console.log('  mod@snackspot.local    (moderator)')
    console.log('  alice@example.com      (user)')
    console.log('  bob@example.com        (user)')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
