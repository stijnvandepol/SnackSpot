import { describe, expect, it, vi, beforeEach } from 'vitest'

// city-index imports `prisma` from lib/db, which constructs a PrismaClient at module load.
// Mock it before importing so no client is ever instantiated during unit tests.
vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    review: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/db'
import {
  citySlug,
  getQualifyingCities,
  getCityDetail,
  CITY_PAGE_MIN_PLACES,
  CITY_PAGE_MIN_REVIEWS,
} from './city-index'

const queryRaw = vi.mocked(prisma.$queryRaw)
const findMany = vi.mocked(prisma.review.findMany)

beforeEach(() => {
  vi.resetAllMocks()
  findMany.mockResolvedValue([] as never)
})

/** A city aggregate row as returned by the grouping query. */
function row(city: string, placeCount: number, reviewCount: number) {
  return { city, place_count: placeCount, review_count: reviewCount }
}

describe('citySlug', () => {
  it.each([
    ['Eindhoven', 'eindhoven'],
    ['Someren-Eind', 'someren-eind'],
    ['Sint Anthonis', 'sint-anthonis'],
    ['Chorzów', 'chorzow'],
    ['Krakau', 'krakau'],
  ])('slugifies %s to %s', (input, expected) => {
    expect(citySlug(input)).toBe(expected)
  })

  it('strips surrounding whitespace and leading punctuation', () => {
    expect(citySlug("  's-Hertogenbosch ")).toBe('s-hertogenbosch')
  })

  it('collapses runs of separators into a single hyphen', () => {
    expect(citySlug('Bergen  op   Zoom')).toBe('bergen-op-zoom')
  })

  it('is stable for names that differ only by diacritics', () => {
    expect(citySlug('Chorzów')).toBe(citySlug('Chorzow'))
  })
})

describe('getQualifyingCities', () => {
  it('keeps a city that meets both thresholds exactly', async () => {
    queryRaw.mockResolvedValue([
      row('Eindhoven', CITY_PAGE_MIN_PLACES, CITY_PAGE_MIN_REVIEWS),
    ] as never)

    const cities = await getQualifyingCities()

    expect(cities).toEqual([
      { slug: 'eindhoven', name: 'Eindhoven', placeCount: 3, reviewCount: 8 },
    ])
  })

  it('rejects a city with enough reviews but too few places', async () => {
    // Two places carrying twenty reviews is not an answer to "beste snackbar <stad>".
    queryRaw.mockResolvedValue([row('Amsterdam', CITY_PAGE_MIN_PLACES - 1, 20)] as never)

    expect(await getQualifyingCities()).toEqual([])
  })

  it('rejects a city with enough places but too few reviews', async () => {
    // The real shape of this data: Keulen had 5 places and only 5 reviews.
    queryRaw.mockResolvedValue([
      row('Keulen', 5, CITY_PAGE_MIN_REVIEWS - 1),
      row('Uden', 3, 4),
    ] as never)

    expect(await getQualifyingCities()).toEqual([])
  })

  it('preserves the order the query returned', async () => {
    queryRaw.mockResolvedValue([row('Eindhoven', 4, 20), row('Tilburg', 3, 9)] as never)

    expect((await getQualifyingCities()).map((c) => c.name)).toEqual(['Eindhoven', 'Tilburg'])
  })

  it('returns nothing when no city qualifies', async () => {
    queryRaw.mockResolvedValue([] as never)

    expect(await getQualifyingCities()).toEqual([])
  })
})

describe('getCityDetail', () => {
  it('returns null for a slug that matches no city', async () => {
    queryRaw.mockResolvedValue([row('Eindhoven', 3, 15)] as never)

    expect(await getCityDetail('rotterdam')).toBeNull()
  })

  it('returns null for a real city that is below the gate', async () => {
    queryRaw.mockResolvedValue([row('Uden', 3, 4)] as never)

    expect(await getCityDetail('uden')).toBeNull()
  })

  it('does not query place detail when the city is below the gate', async () => {
    queryRaw.mockResolvedValue([row('Uden', 3, 4)] as never)

    await getCityDetail('uden')

    // Only the aggregate query should have run — no wasted detail queries.
    expect(queryRaw).toHaveBeenCalledTimes(1)
  })

  it('assembles places, their top dish and the city dish aggregate', async () => {
    queryRaw
      .mockResolvedValueOnce([row('Eindhoven', 3, 15)] as never)
      .mockResolvedValueOnce([
        {
          id: 'p1',
          name: 'Cafetaria De Hoek',
          address: 'Kerkstraat 1, Eindhoven',
          cuisine: 'dutch',
          avg_rating: 4.6,
          review_count: 9,
        },
      ] as never)
      .mockResolvedValueOnce([
        { dish: 'Kapsalon', review_count: 7, avg_rating: 4.5 },
        { dish: 'Patatje oorlog', review_count: 4, avg_rating: 4.1 },
      ] as never)
      .mockResolvedValueOnce([{ place_id: 'p1', dish: 'Kapsalon' }] as never)

    const detail = await getCityDetail('eindhoven')

    expect(detail).not.toBeNull()
    expect(detail!.name).toBe('Eindhoven')
    expect(detail!.places).toHaveLength(1)
    expect(detail!.places[0]).toMatchObject({
      id: 'p1',
      name: 'Cafetaria De Hoek',
      avgRating: 4.6,
      reviewCount: 9,
      topDish: 'Kapsalon',
    })
    expect(detail!.topDishes).toEqual([
      { name: 'Kapsalon', count: 7, avgRating: 4.5 },
      { name: 'Patatje oorlog', count: 4, avgRating: 4.1 },
    ])
  })

  it('leaves topDish null for a place whose reviews name no dish', async () => {
    queryRaw
      .mockResolvedValueOnce([row('Eindhoven', 3, 15)] as never)
      .mockResolvedValueOnce([
        {
          id: 'p2',
          name: 'Snackbar Zonder Naam',
          address: 'Dorpsstraat 2, Eindhoven',
          cuisine: null,
          avg_rating: null,
          review_count: 2,
        },
      ] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)

    const detail = await getCityDetail('eindhoven')

    expect(detail!.places[0].topDish).toBeNull()
    expect(detail!.places[0].photoUrl).toBeNull()
    expect(detail!.topDishes).toEqual([])
  })

  it('attaches the newest photo per place without querying per place', async () => {
    queryRaw
      .mockResolvedValueOnce([row('Eindhoven', 3, 15)] as never)
      .mockResolvedValueOnce([
        {
          id: 'p1',
          name: 'Cafetaria De Hoek',
          address: 'Kerkstraat 1, Eindhoven',
          cuisine: null,
          avg_rating: 4.6,
          review_count: 9,
        },
      ] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)

    findMany.mockResolvedValue([
      { placeId: 'p1', reviewPhotos: [{ photo: { variants: { medium: 'variants/abc/medium.webp' } } }] },
      { placeId: 'p1', reviewPhotos: [{ photo: { variants: { medium: 'variants/older/medium.webp' } } }] },
    ] as never)

    const detail = await getCityDetail('eindhoven')

    expect(findMany).toHaveBeenCalledTimes(1)
    // First row wins: the query is ordered newest-first.
    expect(detail!.places[0].photoUrl).toContain('variants%2Fabc%2Fmedium.webp')
  })
})
