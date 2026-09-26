import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    place: { findMany: vi.fn() },
    review: { findMany: vi.fn(), groupBy: vi.fn() },
    user: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/city-index', () => ({
  getQualifyingCities: vi.fn(),
  getQualifyingCityDishes: vi.fn(),
  getPhotoByPlace: vi.fn(),
}))
vi.mock('@/lib/dish-index', () => ({ getQualifyingDishes: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

import { prisma } from '@/lib/db'
import { getPhotoByPlace, getQualifyingCities, getQualifyingCityDishes } from '@/lib/city-index'
import { getQualifyingDishes } from '@/lib/dish-index'
import sitemap from './sitemap'

const getCities = vi.mocked(getQualifyingCities)
const getCityDishes = vi.mocked(getQualifyingCityDishes)

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(prisma.review.groupBy).mockResolvedValue([] as never)
  vi.mocked(getPhotoByPlace).mockResolvedValue(new Map())
  vi.mocked(prisma.review.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.user.findMany).mockResolvedValue([] as never)
  getCities.mockResolvedValue([])
  getCityDishes.mockResolvedValue([])
  vi.mocked(getQualifyingDishes).mockResolvedValue([])
})

async function urls(): Promise<string[]> {
  return (await sitemap()).map((entry) => entry.url)
}

describe('sitemap thin-content filtering', () => {
  // GSC crawl stats (Aug 2026): only ~9.9% of crawls went to discovering new URLs, while
  // individual reviews and profiles made up most of the sitemap. Announcing every
  // one-paragraph page spends that budget on the pages least worth indexing.

  it('only asks for reviews that have a photo and a named dish', async () => {
    await sitemap()

    expect(vi.mocked(prisma.review.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          reviewPhotos: { some: {} },
          dishName: { not: null },
        }),
      }),
    )
  })

  it('only asks for profiles that have published something', async () => {
    await sitemap()

    expect(vi.mocked(prisma.user.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bannedAt: null,
          reviews: { some: { status: 'PUBLISHED' } },
        }),
      }),
    )
  })

  it('drops profiles below the review threshold', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { username: 'prolific', updatedAt: new Date(), _count: { reviews: 3 } },
      { username: 'stub', updatedAt: new Date(), _count: { reviews: 1 } },
    ] as never)

    const result = await urls()

    expect(result).toContain('https://snackspot.online/u/prolific')
    expect(result).not.toContain('https://snackspot.online/u/stub')
  })

  it('escapes usernames that are not URL-safe', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { username: 'a b', updatedAt: new Date(), _count: { reviews: 5 } },
    ] as never)

    expect(await urls()).toContain('https://snackspot.online/u/a%20b')
  })
})

describe('sitemap city entries', () => {
  it('always lists the /snackplekken index', async () => {
    expect(await urls()).toContain('https://snackspot.online/snackplekken')
  })

  it('lists a URL for every qualifying city', async () => {
    getCities.mockResolvedValue([
      { slug: 'eindhoven', name: 'Eindhoven', placeCount: 3, reviewCount: 15 },
      { slug: 'someren-eind', name: 'Someren-Eind', placeCount: 3, reviewCount: 9 },
    ])

    const result = await urls()

    expect(result).toContain('https://snackspot.online/snackplekken/eindhoven')
    expect(result).toContain('https://snackspot.online/snackplekken/someren-eind')
  })

  it('lists no city URLs when no city qualifies', async () => {
    getCities.mockResolvedValue([])

    // A city below the gate has no page, so advertising one would send Google to a 404.
    expect((await urls()).filter((url) => url.includes('/snackplekken/'))).toEqual([])
  })

  it('lists a URL for every dish that earned its own page', async () => {
    getCities.mockResolvedValue([
      { slug: 'eindhoven', name: 'Eindhoven', placeCount: 3, reviewCount: 15 },
    ])
    getCityDishes.mockResolvedValue([
      { slug: 'kapsalon', name: 'Kapsalon', key: 'kapsalon', placeCount: 3, reviewCount: 9, avgRating: 4.4 },
    ])

    expect(await urls()).toContain('https://snackspot.online/snackplekken/eindhoven/kapsalon')
  })

  it('lists no dish URLs when no dish clears the dish gate', async () => {
    getCities.mockResolvedValue([
      { slug: 'eindhoven', name: 'Eindhoven', placeCount: 3, reviewCount: 15 },
    ])
    getCityDishes.mockResolvedValue([])

    // Same contract as the city gate: a dish below the gate has no page, so advertising
    // one would send Google to a 404.
    expect((await urls()).filter((url) => url.split('/').length > 5)).toEqual([])
  })

  it('sources cities from the same gate the pages use', async () => {
    await sitemap()

    expect(getCities).toHaveBeenCalledTimes(1)
  })

  it('still degrades to static entries when the database fails', async () => {
    vi.mocked(prisma.review.groupBy).mockRejectedValue(new Error('connection refused'))

    const result = await urls()

    expect(result).toContain('https://snackspot.online/snackplekken')
    // getSiteUrl() strips the trailing slash, so the homepage entry is the bare origin.
    expect(result).toContain('https://snackspot.online')
    expect(result.filter((url) => url.includes('/snackplekken/'))).toEqual([])
  })
})

describe('sitemap — national dish pages', () => {
  it('lists the hub and every dish that clears the gate', async () => {
    vi.mocked(getQualifyingDishes).mockResolvedValue([
      { slug: 'frikandel-speciaal', name: 'Frikandel speciaal', key: 'frikandel speciaal', placeCount: 3, cityCount: 2, reviewCount: 5, avgRating: 4.2 },
    ])
    const all = await urls()
    expect(all).toContain('https://snackspot.online/gerechten')
    expect(all).toContain('https://snackspot.online/gerechten/frikandel-speciaal')
  })
})

describe('sitemap dates and images', () => {
  // Google stops trusting <lastmod> on a site whose dates move without the content moving.
  // "Now" on every generation was exactly that; each entry now carries its own content date.
  const reviewedAt = new Date('2026-09-20T10:00:00Z')

  it('dates a place by its newest review and attaches its photo', async () => {
    vi.mocked(prisma.review.groupBy).mockResolvedValue([
      { placeId: 'p1', _max: { updatedAt: reviewedAt } },
    ] as never)
    vi.mocked(getPhotoByPlace).mockResolvedValue(new Map([['p1', '/api/v1/photos/variant?key=a%2Fb.webp']]))

    const place = (await sitemap()).find((entry) => entry.url.endsWith('/place/p1'))!
    expect(place.lastModified).toEqual(reviewedAt)
    expect(place.images).toEqual(['https://snackspot.online/api/v1/photos/variant?key=a%2Fb.webp'])
  })

  it('escapes & in image URLs, because Next writes <image:loc> verbatim', async () => {
    vi.mocked(prisma.review.groupBy).mockResolvedValue([{ placeId: 'p1', _max: { updatedAt: reviewedAt } }] as never)
    vi.mocked(getPhotoByPlace).mockResolvedValue(new Map([['p1', '/x?a=1&b=2']]))
    const place = (await sitemap()).find((entry) => entry.url.endsWith('/place/p1'))!
    expect(place.images).toEqual(['https://snackspot.online/x?a=1&amp;b=2'])
  })

  it('dates city and dish pages by their newest review, not by the build time', async () => {
    getCities.mockResolvedValue([
      { slug: 'eindhoven', name: 'Eindhoven', placeCount: 3, reviewCount: 9, lastModified: reviewedAt.toISOString() },
    ])
    vi.mocked(getQualifyingDishes).mockResolvedValue([
      { slug: 'kapsalon', name: 'Kapsalon', key: 'kapsalon', placeCount: 2, cityCount: 1, reviewCount: 3, avgRating: 4, lastModified: reviewedAt.toISOString() },
    ])
    const all = await sitemap()
    expect(all.find((e) => e.url.endsWith('/snackplekken/eindhoven'))!.lastModified).toEqual(reviewedAt)
    expect(all.find((e) => e.url.endsWith('/gerechten/kapsalon'))!.lastModified).toEqual(reviewedAt)
    expect(all.find((e) => e.url.endsWith('/snackplekken'))!.lastModified).toEqual(reviewedAt)
  })

  it('never dates an entry in the future of its content', async () => {
    const before = Date.now()
    for (const entry of await sitemap()) {
      expect(+new Date(entry.lastModified as Date)).toBeLessThan(before)
    }
  })
})
