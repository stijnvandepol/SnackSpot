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
  if (opts.verify && input.provider === placesProvider.id) {
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

  const nearby = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
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

  const [created] = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO places (name, address, provider, location)
    VALUES (
      ${input.name}, ${input.address}, 'manual',
      ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
    )
    RETURNING id
  `
  return { id: created.id, deduped: false }
}

export { Prisma }
