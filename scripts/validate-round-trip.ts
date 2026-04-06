#!/usr/bin/env tsx
import { Client } from 'pg'
import * as Minio from 'minio'

// ── Environment validation ────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required')
  process.exit(1)
}
if (!MINIO_ACCESS_KEY) {
  console.error('Error: MINIO_ACCESS_KEY environment variable is required')
  process.exit(1)
}
if (!MINIO_SECRET_KEY) {
  console.error('Error: MINIO_SECRET_KEY environment variable is required')
  process.exit(1)
}

// ── Table names constant (snake_case, matching PostgreSQL table names) ──

const TABLE_NAMES = [
  'users',
  'places',
  'reviews',
  'photos',
  'review_photos',
  'comments',
  'badges',
  'user_badges',
  'review_likes',
  'favorites',
  'reports',
  'moderation_actions',
  'notifications',
  'notification_preferences',
  'review_mentions',
  'review_tags',
  'blocked_words',
  'flagged_comments',
]

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const snapshotIndex = args.indexOf('--snapshot')
  const saveSnapshotIndex = args.indexOf('--save-snapshot')
  let snapshotFile: string | null = null
  let saveFile: string | null = null

  if (snapshotIndex !== -1) snapshotFile = args[snapshotIndex + 1] ?? null
  if (saveSnapshotIndex !== -1) saveFile = args[saveSnapshotIndex + 1] ?? null

  const pg = new Client({ connectionString: DATABASE_URL })
  const minio = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: MINIO_ACCESS_KEY!,
    secretKey: MINIO_SECRET_KEY!,
  })
  const bucket = process.env.MINIO_BUCKET || 'snackspot'

  await pg.connect()
  let passed = true

  // ── Table record counts ───────────────────────────────────────
  console.log('\n=== Table Record Counts ===\n')
  const counts: Record<string, number> = {}
  for (const table of TABLE_NAMES) {
    const { rows } = await pg.query(`SELECT COUNT(*)::int AS n FROM "${table}"`)
    counts[table] = rows[0].n
    console.log(`  ${table}: ${rows[0].n}`)
  }

  // ── Snapshot comparison (if --snapshot provided) ──────────────
  if (snapshotFile) {
    const fs = await import('fs/promises')
    const raw = await fs.readFile(snapshotFile, 'utf-8')
    const snapshot = JSON.parse(raw) as { counts?: Record<string, number>; coordinates?: Array<{ name: string; lat: number; lng: number }> }
    console.log('\n=== Snapshot Comparison ===\n')
    for (const table of TABLE_NAMES) {
      const expected = snapshot.counts?.[table] ?? 0
      const actual = counts[table]
      const match = expected === actual
      if (!match) passed = false
      console.log(`  ${table}: ${actual}/${expected} ${match ? 'PASS' : 'FAIL'}`)
    }

    // Coordinate comparison with tolerance (D-10)
    if (snapshot.coordinates && snapshot.coordinates.length > 0) {
      const TOLERANCE = 0.000001
      const { rows: allPlaces } = await pg.query(`
        SELECT name, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM places ORDER BY name
      `)
      console.log('\n  Coordinate comparison (6 decimal tolerance):')
      for (const place of allPlaces) {
        const ref = snapshot.coordinates.find((c) => c.name === place.name)
        if (ref) {
          const latDiff = Math.abs(parseFloat(place.lat) - ref.lat)
          const lngDiff = Math.abs(parseFloat(place.lng) - ref.lng)
          const ok = latDiff < TOLERANCE && lngDiff < TOLERANCE
          if (!ok) passed = false
          console.log(`    ${place.name}: lat diff=${latDiff.toFixed(8)}, lng diff=${lngDiff.toFixed(8)} ${ok ? 'PASS' : 'FAIL'}`)
        }
      }
    }
  }

  // ── Save snapshot (if --save-snapshot provided) ───────────────
  if (saveFile) {
    const fs = await import('fs/promises')
    const { rows: allPlaces } = await pg.query(`
      SELECT name, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM places ORDER BY name
    `)
    const coordinates = allPlaces.map((p) => ({
      name: p.name,
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lng),
    }))
    await fs.writeFile(saveFile, JSON.stringify({ counts, coordinates, timestamp: new Date().toISOString() }, null, 2))
    console.log(`\nSnapshot saved to ${saveFile}`)
  }

  // ── Photo accessibility check ─────────────────────────────────
  console.log('\n=== Photo Accessibility ===\n')
  const { rows: photos } = await pg.query('SELECT storage_key FROM photos')
  let accessible = 0
  let missing = 0
  const missingKeys: string[] = []

  for (const { storage_key } of photos) {
    const ok = await minio.statObject(bucket, storage_key).then(() => true).catch(() => false)
    if (ok) {
      accessible++
    } else {
      missing++
      missingKeys.push(storage_key)
      passed = false
    }
  }

  console.log(`  Total photos in DB: ${photos.length}`)
  console.log(`  Accessible in MinIO: ${accessible}`)
  console.log(`  Missing from MinIO: ${missing}`)
  if (missingKeys.length > 0 && missingKeys.length <= 20) {
    console.log('  Missing keys:')
    for (const key of missingKeys) {
      console.log(`    - ${key}`)
    }
  } else if (missingKeys.length > 20) {
    console.log(`  (${missingKeys.length} missing keys, showing first 20)`)
    for (const key of missingKeys.slice(0, 20)) {
      console.log(`    - ${key}`)
    }
  }

  // ── PostGIS lat/lng spot check (D-09, D-10) ───────────────────
  console.log('\n=== PostGIS Coordinate Check ===\n')
  const { rows: placesWithCoords } = await pg.query(`
    SELECT id, name,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng
    FROM places
    LIMIT 10
  `)

  if (placesWithCoords.length === 0) {
    console.log('  No places found — skipping coordinate check')
  } else {
    console.log(`  Spot-checking ${placesWithCoords.length} places for valid coordinates:`)
    for (const place of placesWithCoords) {
      const lat = parseFloat(place.lat)
      const lng = parseFloat(place.lng)
      const validLat = lat >= -90 && lat <= 90
      const validLng = lng >= -180 && lng <= 180
      const ok = validLat && validLng
      if (!ok) passed = false
      console.log(`  ${place.name}: lat=${lat.toFixed(6)}, lng=${lng.toFixed(6)} ${ok ? 'PASS' : 'FAIL'}`)
    }
  }

  // ── Final result ──────────────────────────────────────────────
  console.log('\n' + '='.repeat(40))
  console.log(passed ? 'RESULT: ALL CHECKS PASSED' : 'RESULT: SOME CHECKS FAILED')
  console.log('='.repeat(40) + '\n')

  await pg.end()
  process.exit(passed ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
