import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { placesProvider, type ProviderPlace } from '@/lib/places-provider'

// Two manual places with the same normalized name within this radius are
// treated as the same venue (dedup guard for the legacy/manual path).
const DUPLICATE_RADIUS_METRES = 75

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics: "Şahin" → "sahin"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Resolves a provider-verified venue to a place row, creating it once.
 *
 * Re-selecting the same venue returns the existing row via the unique
 * (provider, provider_place_id) constraint — near-duplicates are impossible.
 * The provider's canonical name/address/coords are stored, never user input.
 *
 * Pass `verify: true` to re-fetch the venue from the provider server-side so a
 * client can't fabricate a providerPlaceId pointing at made-up coordinates.
 */
export async function resolveProviderPlace(
  input: { provider: string; providerPlaceId: string } & Partial<ProviderPlace>,
  opts: { verify?: boolean } = {},
): Promise<{ id: string } | { error: string }> {
  const existing = await prisma.place.findFirst({
    where: { provider: input.provider, providerPlaceId: input.providerPlaceId },
    select: { id: true },
  })
  if (existing) return existing

  let venue: ProviderPlace | null = null
  if (opts.verify) {
    // Verification requested: the provider must be the active one and the
    // lookup must succeed. We never fall back to client-supplied coordinates
    // here — that would defeat the point of verifying.
    if (input.provider !== placesProvider.id) {
      return { error: 'Unknown place provider.' }
    }
    venue = await placesProvider.lookup(input.providerPlaceId)
    if (!venue) return { error: 'Could not verify this place. Pick it from the list again.' }
  } else if (input.name && input.address && input.lat != null && input.lng != null) {
    venue = {
      provider: input.provider,
      providerPlaceId: input.providerPlaceId,
      name: input.name,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      city: input.city ?? null,
    }
  } else {
    return { error: 'Incomplete place data.' }
  }

  // Insert keyed by provider id; on a concurrent race the unique index makes
  // the second insert a no-op and we re-read the winner.
  const inserted = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO places (name, address, city, provider, provider_place_id, location)
    VALUES (
      ${venue.name}, ${venue.address}, ${venue.city},
      ${venue.provider}, ${venue.providerPlaceId},
      ST_SetSRID(ST_MakePoint(${venue.lng}, ${venue.lat}), 4326)::geography
    )
    ON CONFLICT (provider, provider_place_id) WHERE provider_place_id IS NOT NULL
    DO NOTHING
    RETURNING id
  `
  if (inserted[0]) return inserted[0]

  const raced = await prisma.place.findFirst({
    where: { provider: venue.provider, providerPlaceId: venue.providerPlaceId },
    select: { id: true },
  })
  return raced ?? { error: 'Could not create place.' }
}

/**
 * Manual/admin place creation with a duplicate guard: if a place with the same
 * normalized name already exists within DUPLICATE_RADIUS_METRES, returns that
 * existing place instead of creating a near-duplicate.
 */
export async function resolveManualPlace(input: {
  name: string
  address: string
  lat: number
  lng: number
}): Promise<{ id: string; deduped: boolean }> {
  const normalized = normalizeName(input.name)

  return prisma.$transaction(async (tx) => {
    // Serialize concurrent inserts of the same normalized name via a
    // transaction-scoped advisory lock, so two requests can't both pass the
    // dedup check and create a near-duplicate. hashtext keeps the key stable.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`place:${normalized}`}))`

    const nearby = await tx.$queryRaw<Array<{ id: string; name: string }>>`
      SELECT id, name
      FROM places
      WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
        ${DUPLICATE_RADIUS_METRES}
      )
    `
    const match = nearby.find((p) => normalizeName(p.name) === normalized)
    if (match) return { id: match.id, deduped: true }

    const [created] = await tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO places (name, address, provider, location)
      VALUES (
        ${input.name}, ${input.address}, 'manual',
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
      )
      RETURNING id
    `
    return { id: created.id, deduped: false }
  })
}

/** A place as shown in the picker: existing SnackSpot place (placeId set) or a
 *  provider venue to add (placeId null). */
export interface PickerPlace {
  placeId: string | null
  provider: string
  providerPlaceId: string | null
  name: string
  address: string
  lat: number
  lng: number
  reviewCount: number
  distanceM: number | null
}

/**
 * Searches existing SnackSpot places by name (trigram/ILIKE on the lowercased
 * name, backed by idx_places_name_lower_trgm). When coordinates are given,
 * results are ordered nearest-first; otherwise by review count. This is what
 * makes already-known venues — including community/manual places the external
 * provider may not have — show up before we ever hit the provider.
 */
export async function searchDbPlaces(
  q: string,
  coords: { lat: number; lng: number } | null,
  limit: number,
): Promise<PickerPlace[]> {
  const pattern = `%${q.trim()}%`

  if (coords) {
    return prisma.$queryRaw<PickerPlace[]>`
      SELECT
        p.id AS "placeId",
        p.provider,
        p.provider_place_id AS "providerPlaceId",
        p.name,
        p.address,
        ST_Y(p.location::geometry) AS lat,
        ST_X(p.location::geometry) AS lng,
        COUNT(r.id)::int AS "reviewCount",
        ST_Distance(p.location, ST_SetSRID(ST_MakePoint(${coords.lng}, ${coords.lat}), 4326)::geography) AS "distanceM"
      FROM places p
      LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
      WHERE LOWER(p.name) ILIKE LOWER(${pattern})
      GROUP BY p.id, p.name, p.address, p.provider, p.provider_place_id, p.location
      ORDER BY "distanceM" ASC
      LIMIT ${limit}
    `
  }

  return prisma.$queryRaw<PickerPlace[]>`
    SELECT
      p.id AS "placeId",
      p.provider,
      p.provider_place_id AS "providerPlaceId",
      p.name,
      p.address,
      ST_Y(p.location::geometry) AS lat,
      ST_X(p.location::geometry) AS lng,
      COUNT(r.id)::int AS "reviewCount",
      NULL::float AS "distanceM"
    FROM places p
    LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
    WHERE LOWER(p.name) ILIKE LOWER(${pattern})
    GROUP BY p.id, p.name, p.address, p.provider, p.provider_place_id, p.location
    ORDER BY "reviewCount" DESC, p.name ASC
    LIMIT ${limit}
  `
}

/**
 * Nearby existing SnackSpot places (no text filter), nearest first. Powers the
 * "places near you" shortcut so a user can reuse an existing venue with one tap.
 */
export async function nearbyDbPlaces(
  coords: { lat: number; lng: number },
  radiusMetres: number,
  limit: number,
): Promise<PickerPlace[]> {
  return prisma.$queryRaw<PickerPlace[]>`
    SELECT
      p.id AS "placeId",
      p.provider,
      p.provider_place_id AS "providerPlaceId",
      p.name,
      p.address,
      ST_Y(p.location::geometry) AS lat,
      ST_X(p.location::geometry) AS lng,
      COUNT(r.id)::int AS "reviewCount",
      ST_Distance(p.location, ST_SetSRID(ST_MakePoint(${coords.lng}, ${coords.lat}), 4326)::geography) AS "distanceM"
    FROM places p
    LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'PUBLISHED'
    WHERE ST_DWithin(
      p.location,
      ST_SetSRID(ST_MakePoint(${coords.lng}, ${coords.lat}), 4326)::geography,
      ${radiusMetres}
    )
    GROUP BY p.id, p.name, p.address, p.provider, p.provider_place_id, p.location
    ORDER BY "distanceM" ASC
    LIMIT ${limit}
  `
}

export { Prisma }
