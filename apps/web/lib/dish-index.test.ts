import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: { $queryRaw: vi.fn(), review: { findMany: vi.fn() } } }))
vi.mock('@/lib/cache', () => ({
  buildCacheKey: (namespace: string, suffix: string) => `${namespace}:${suffix}`,
  getCachedJson: vi.fn(async () => null),
  setCachedJson: vi.fn(async () => undefined),
}))

import { DISH_PAGE_MIN_PLACES, DISH_PAGE_MIN_REVIEWS, toQualifyingDishes } from './dish-index'

function row(dish: string, placeCount: number, reviewCount: number) {
  return {
    dish,
    dish_key: dish.toLowerCase(),
    place_count: placeCount,
    city_count: 1,
    review_count: reviewCount,
    avg_rating: 4,
  }
}

describe('toQualifyingDishes', () => {
  it('keeps dishes at the gate and drops those below it', () => {
    const result = toQualifyingDishes([
      row('Kapsalon', DISH_PAGE_MIN_PLACES, DISH_PAGE_MIN_REVIEWS),
      row('Bitterballen', DISH_PAGE_MIN_PLACES - 1, 10),
      row('Kroket', 5, DISH_PAGE_MIN_REVIEWS - 1),
    ])
    expect(result.map((d) => d.slug)).toEqual(['kapsalon'])
  })

  it('slugs names and keeps the first of two spellings that collide', () => {
    const result = toQualifyingDishes([row('Frikandel speciaal', 3, 9), row('Frikandel  Speciaal!', 2, 3)])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ slug: 'frikandel-speciaal', name: 'Frikandel speciaal' })
  })

  it('drops names that produce an empty slug', () => {
    expect(toQualifyingDishes([row('🍟🍟', 3, 9)])).toEqual([])
  })
})
