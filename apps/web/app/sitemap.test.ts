import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    place: { findMany: vi.fn() },
    review: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/city-index', () => ({ getQualifyingCities: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

import { prisma } from '@/lib/db'
import { getQualifyingCities } from '@/lib/city-index'
import sitemap from './sitemap'

const getCities = vi.mocked(getQualifyingCities)

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(prisma.place.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.review.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.user.findMany).mockResolvedValue([] as never)
  getCities.mockResolvedValue([])
})

async function urls(): Promise<string[]> {
  return (await sitemap()).map((entry) => entry.url)
}

describe('sitemap city entries', () => {
  it('always lists the /snackbars index', async () => {
    expect(await urls()).toContain('https://snackspot.online/snackbars')
  })

  it('lists a URL for every qualifying city', async () => {
    getCities.mockResolvedValue([
      { slug: 'eindhoven', name: 'Eindhoven', placeCount: 3, reviewCount: 15 },
      { slug: 'someren-eind', name: 'Someren-Eind', placeCount: 3, reviewCount: 9 },
    ])

    const result = await urls()

    expect(result).toContain('https://snackspot.online/snackbars/eindhoven')
    expect(result).toContain('https://snackspot.online/snackbars/someren-eind')
  })

  it('lists no city URLs when no city qualifies', async () => {
    getCities.mockResolvedValue([])

    // A city below the gate has no page, so advertising one would send Google to a 404.
    expect((await urls()).filter((url) => url.includes('/snackbars/'))).toEqual([])
  })

  it('sources cities from the same gate the pages use', async () => {
    await sitemap()

    expect(getCities).toHaveBeenCalledTimes(1)
  })

  it('still degrades to static entries when the database fails', async () => {
    vi.mocked(prisma.place.findMany).mockRejectedValue(new Error('connection refused'))

    const result = await urls()

    expect(result).toContain('https://snackspot.online/snackbars')
    // getSiteUrl() strips the trailing slash, so the homepage entry is the bare origin.
    expect(result).toContain('https://snackspot.online')
    expect(result.filter((url) => url.includes('/snackbars/'))).toEqual([])
  })
})
