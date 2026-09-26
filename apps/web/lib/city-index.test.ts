import { describe, expect, it, vi, beforeEach } from 'vitest'

// city-index imports `prisma` from lib/db, which constructs a PrismaClient at module load.
// Mock it before importing so no client is ever instantiated during unit tests.
vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    review: { findMany: vi.fn() },
  },
}))

// The city list is cached in Redis. Under test there is no Redis (and the client would wait
// for one indefinitely), so the cache always misses and every call reaches the mocked query.
vi.mock('@/lib/cache', () => ({
  buildCacheKey: (namespace: string, suffix: string) => `${namespace}:${suffix}`,
  getCachedJson: vi.fn(async () => null),
  setCachedJson: vi.fn(async () => undefined),
}))

import { prisma } from '@/lib/db'
import {
  citySlug,
  getQualifyingCities,
  getCityDetail,
  getQualifyingCityDishes,
  getCityDishDetail,
  CITY_PAGE_MIN_PLACES,
  CITY_PAGE_MIN_REVIEWS,
  CITY_DISH_PAGE_MIN_PLACES,
  CITY_DISH_PAGE_MIN_REVIEWS,
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
  it('gives a city with a single reviewed place its own page', async () => {
    // The point of lowering the gate: somebody searching "snackplek Uden" wants that one
    // address, and a page naming it beats no page at all.
    queryRaw.mockResolvedValue([
      row('Uden', CITY_PAGE_MIN_PLACES, CITY_PAGE_MIN_REVIEWS),
    ] as never)

    expect(await getQualifyingCities()).toEqual([
      { slug: 'uden', name: 'Uden', placeCount: 1, reviewCount: 1, lastModified: null },
    ])
  })

  it('rejects a city whose places have no published review', async () => {
    // The one case with genuinely nothing to render. This is the difference between a
    // short page and an empty one, and it is the only reason the floor is 1 and not 0.
    queryRaw.mockResolvedValue([row('Amsterdam', 4, 0)] as never)

    expect(await getQualifyingCities()).toEqual([])
  })

  it('keeps larger cities too', async () => {
    queryRaw.mockResolvedValue([row('Eindhoven', 3, 15)] as never)

    expect(await getQualifyingCities()).toEqual([
      { slug: 'eindhoven', name: 'Eindhoven', placeCount: 3, reviewCount: 15, lastModified: null },
    ])
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
    queryRaw.mockResolvedValue([row('Uden', 3, 0)] as never)

    expect(await getCityDetail('uden')).toBeNull()
  })

  it('does not query place detail when the city is below the gate', async () => {
    queryRaw.mockResolvedValue([row('Uden', 3, 0)] as never)

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
      // Fifth call: the per-city dish gate. No dish clears it in this fixture.
      .mockResolvedValue([] as never)

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
          name: 'Snackplek Zonder Naam',
          address: 'Dorpsstraat 2, Eindhoven',
          cuisine: null,
          avg_rating: null,
          review_count: 2,
        },
      ] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValue([] as never)
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
      // Fifth call: the per-city dish gate.
      .mockResolvedValue([] as never)

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


/** A dish aggregate row as returned by the per-city dish grouping query. */
function dishRow(dish: string, placeCount: number, reviewCount: number, avgRating = 4.2) {
  return {
    dish,
    dish_key: dish.toLowerCase().trim(),
    place_count: placeCount,
    review_count: reviewCount,
    avg_rating: avgRating,
  }
}

describe('getQualifyingCityDishes', () => {
  it('keeps a dish that clears both thresholds', async () => {
    queryRaw.mockResolvedValue([
      dishRow('Kapsalon', CITY_DISH_PAGE_MIN_PLACES, CITY_DISH_PAGE_MIN_REVIEWS),
    ] as never)

    const dishes = await getQualifyingCityDishes('Eindhoven')

    expect(dishes).toHaveLength(1)
    expect(dishes[0]).toMatchObject({ slug: 'kapsalon', name: 'Kapsalon', key: 'kapsalon' })
  })

  it('drops a dish served by too few places', async () => {
    // The page compares places on one dish. With one address there is nothing to compare,
    // which is exactly the thin page the gate exists to prevent.
    queryRaw.mockResolvedValue([
      dishRow('Kapsalon', CITY_DISH_PAGE_MIN_PLACES - 1, CITY_DISH_PAGE_MIN_REVIEWS + 20),
    ] as never)

    expect(await getQualifyingCityDishes('Eindhoven')).toEqual([])
  })

  it('drops a dish with too few reviews', async () => {
    queryRaw.mockResolvedValue([
      dishRow('Kapsalon', CITY_DISH_PAGE_MIN_PLACES + 5, CITY_DISH_PAGE_MIN_REVIEWS - 1),
    ] as never)

    expect(await getQualifyingCityDishes('Eindhoven')).toEqual([])
  })

  it('keeps only the first of two dishes that slugify the same', async () => {
    // Two spellings that collapse to one URL would make the second page unreachable.
    queryRaw.mockResolvedValue([
      dishRow('Frikandel speciaal', 4, 12),
      dishRow('Frikandel  Speciaal!', 3, 6),
    ] as never)

    const dishes = await getQualifyingCityDishes('Uden')

    expect(dishes.map((dish) => dish.slug)).toEqual(['frikandel-speciaal'])
    expect(dishes[0].reviewCount).toBe(12)
  })
})

describe('getCityDishDetail', () => {
  it('returns null when the city is below the city gate', async () => {
    queryRaw.mockResolvedValue([row('Uden', 1, 2)] as never)

    expect(await getCityDishDetail('uden', 'kapsalon')).toBeNull()
  })

  it('returns null when the dish is below the dish gate', async () => {
    queryRaw
      .mockResolvedValueOnce([row('Eindhoven', 3, 15)] as never)
      .mockResolvedValueOnce([dishRow('Kapsalon', 1, 1)] as never)

    expect(await getCityDishDetail('eindhoven', 'kapsalon')).toBeNull()
  })

  it('returns null for a dish slug that does not exist in this city', async () => {
    queryRaw
      .mockResolvedValueOnce([row('Eindhoven', 3, 15)] as never)
      .mockResolvedValueOnce([dishRow('Kapsalon', 3, 9)] as never)

    expect(await getCityDishDetail('eindhoven', 'patatje-oorlog')).toBeNull()
  })

  it('ranks places on their rating for that dish alone', async () => {
    queryRaw
      .mockResolvedValueOnce([row('Eindhoven', 3, 15)] as never)
      .mockResolvedValueOnce([dishRow('Kapsalon', 3, 9, 4.3)] as never)
      .mockResolvedValueOnce([
        { id: 'p1', name: 'De Hoek', address: 'Kerkstraat 1', avg_rating: 4.8, review_count: 4, quote: 'Ruim en goed gekruid.' },
        { id: 'p2', name: 'Snackpoint', address: 'Dorpsweg 3', avg_rating: 4.1, review_count: 5, quote: null },
      ] as never)

    const detail = await getCityDishDetail('eindhoven', 'kapsalon')

    expect(detail?.city.name).toBe('Eindhoven')
    expect(detail?.name).toBe('Kapsalon')
    expect(detail?.places.map((place) => place.id)).toEqual(['p1', 'p2'])
    expect(detail?.places[0].quote).toBe('Ruim en goed gekruid.')
  })
})

describe('getCityDetail dish pages', () => {
  it('exposes the dishes that earned their own page', async () => {
    queryRaw
      .mockResolvedValueOnce([row('Eindhoven', 3, 15)] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([dishRow('Kapsalon', 3, 9, 4.4)] as never)

    const detail = await getCityDetail('eindhoven')

    // The city page links to these, so they must come from the same gate the dish page
    // itself applies — otherwise the link would 404.
    expect(detail!.dishPages).toEqual([
      {
        slug: 'kapsalon',
        name: 'Kapsalon',
        key: 'kapsalon',
        placeCount: 3,
        reviewCount: 9,
        avgRating: 4.4,
        lastModified: null,
      },
    ])
  })
})

describe('lastModified', () => {
  it('carries the newest review date of a city as an ISO string, for the sitemap', async () => {
    queryRaw.mockResolvedValueOnce([
      { city: 'Eindhoven', place_count: 3, review_count: 9, last_modified: new Date('2026-09-20T10:00:00Z') },
    ] as never)
    expect((await getQualifyingCities())[0].lastModified).toBe('2026-09-20T10:00:00.000Z')
  })
})
