#!/usr/bin/env node
/**
 * Seed script - creates demo data for local development.
 * Run after migrations: pnpm --filter @snackspot/db seed
 */
import pg from 'pg'

// In production the API hashes with argon2id.
// Seed users use a fixed argon2id hash for "Password1!". Regenerate with:
//   node -e "import('argon2').then(async (a) => console.log(await a.default.hash('Password1!', { type: a.default.argon2id })))"
// (run from apps/web, which has argon2 installed) and paste the output here.
const DEMO_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$HkRM6uG6jSQeUPM23jJrIw$lsnw3tKBSW9cmFEpjq+9Mjwif8+FDNGgghHZUnQp7b4'

const { Client } = pg

async function main() {
  // Hard guard: these are dev fixtures with a publicly-known password and a
  // default ADMIN account. They must never touch a production database.
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV=production. Seed data is for development only.')
    process.exit(1)
  }

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
      ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash
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

    // The structured rating columns (migration 006) are NOT NULL with a
    // 1.0-5.0 range check, so they must be seeded explicitly. The app derives
    // rating (and rating_overall) as the half-step-rounded mean of
    // taste/value/portion (lib/ratings.ts computeOverallRating) — keep the
    // seeded values consistent with that, or editing a seeded review without
    // changes would alter its rating.
    await client.query(`
      INSERT INTO reviews (id, user_id, place_id, rating,
                           rating_taste, rating_value, rating_portion, rating_overall,
                           text, dish_name, status)
      VALUES
        ('rev_01', 'user_test_01', 'place_01', 4.5, 5, 4, 5, 4.5,
         'Best stroopwafels in Amsterdam! Crispy, warm, and perfectly sweet.',
         'Stroopwafel', 'PUBLISHED'),
        ('rev_02', 'user_test_02', 'place_01', 3.5, 4, 4, 3, 3.5,
         'Really good but the queue was long. Worth the wait though.',
         'Mini Stroopwafel', 'PUBLISHED'),
        ('rev_03', 'user_test_01', 'place_02', 4.5, 5, 5, 4, 4.5,
         'Fresh herring from the bucket, just like oma used to make.',
         'Hollandse Nieuwe', 'PUBLISHED'),
        ('rev_04', 'user_test_02', 'place_03', 3.5, 4, 3, 4, 3.5,
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
