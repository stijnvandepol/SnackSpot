import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/city-index', () => ({
  getCityDetail: vi.fn(),
  getQualifyingCities: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

import { notFound } from 'next/navigation'
import { getCityDetail, getQualifyingCities, type CityDetail } from '@/lib/city-index'
import CityPage, { generateMetadata, generateStaticParams } from './page'

const cityDetail = vi.mocked(getCityDetail)
const qualifying = vi.mocked(getQualifyingCities)

beforeEach(() => vi.clearAllMocks())

function detail(overrides: Partial<CityDetail> = {}): CityDetail {
  return {
    slug: 'eindhoven',
    name: 'Eindhoven',
    placeCount: 3,
    reviewCount: 15,
    places: [
      {
        id: 'p1',
        name: 'Cafetaria De Hoek',
        address: 'Kerkstraat 1, Eindhoven',
        cuisine: null,
        avgRating: 4.6,
        reviewCount: 9,
        photoUrl: '/api/v1/photos/variant?key=a',
        topDish: 'Kapsalon',
      },
    ],
    topDishes: [{ name: 'Kapsalon', count: 7, avgRating: 4.5 }],
    ...overrides,
  }
}

describe('city page gating', () => {
  it('404s when the city is below the quality gate', async () => {
    cityDetail.mockResolvedValue(null)

    await expect(CityPage({ params: Promise.resolve({ stad: 'uden' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
    expect(notFound).toHaveBeenCalled()
  })

  it('renders without calling notFound for a qualifying city', async () => {
    cityDetail.mockResolvedValue(detail())

    await expect(
      CityPage({ params: Promise.resolve({ stad: 'eindhoven' }) }),
    ).resolves.toBeTruthy()
    expect(notFound).not.toHaveBeenCalled()
  })

  it('only pre-builds cities that clear the gate', async () => {
    qualifying.mockResolvedValue([
      { slug: 'eindhoven', name: 'Eindhoven', placeCount: 3, reviewCount: 15 },
    ])

    expect(await generateStaticParams()).toEqual([{ stad: 'eindhoven' }])
  })
})

describe('city page metadata', () => {
  it('builds a Dutch title and canonical from the city', async () => {
    cityDetail.mockResolvedValue(detail())

    const meta = await generateMetadata({ params: Promise.resolve({ stad: 'eindhoven' }) })

    expect(meta.title).toEqual({ absolute: 'De beste snackbars in Eindhoven — SnackSpot' })
    expect(meta.alternates?.canonical).toBe('/snackbars/eindhoven')
    expect(meta.description).toContain('3 snackbars in Eindhoven')
    expect(meta.description).toContain('15 fotoreviews')
  })

  it('names the top dishes in the description when there are any', async () => {
    cityDetail.mockResolvedValue(detail())

    const meta = await generateMetadata({ params: Promise.resolve({ stad: 'eindhoven' }) })

    expect(meta.description).toContain('Kapsalon')
  })

  it('falls back to generic copy when no dish is named', async () => {
    cityDetail.mockResolvedValue(detail({ topDishes: [] }))

    const meta = await generateMetadata({ params: Promise.resolve({ stad: 'eindhoven' }) })

    expect(meta.description).toContain('wat je het beste kunt bestellen')
  })

  it('uses the first available place photo as the social image', async () => {
    cityDetail.mockResolvedValue(detail())

    const meta = await generateMetadata({ params: Promise.resolve({ stad: 'eindhoven' }) })

    expect(meta.openGraph?.images).toEqual(['/api/v1/photos/variant?key=a'])
  })

  it('omits the social image when no place has a photo', async () => {
    cityDetail.mockResolvedValue(
      detail({ places: [{ ...detail().places[0], photoUrl: null }] }),
    )

    const meta = await generateMetadata({ params: Promise.resolve({ stad: 'eindhoven' }) })

    expect(meta.openGraph?.images).toBeUndefined()
  })

  it('returns a neutral title for an unknown city rather than throwing', async () => {
    cityDetail.mockResolvedValue(null)

    expect(await generateMetadata({ params: Promise.resolve({ stad: 'nergens' }) })).toEqual({
      title: 'Niet gevonden',
    })
  })
})
