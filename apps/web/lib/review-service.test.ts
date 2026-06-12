import { describe, it, expect } from 'vitest'
import { buildReviewCreateData, buildReviewUpdateData } from './review-service'

const ratings = { taste: 4, value: 5, portion: 3, service: 2, overall: 3.5 }

describe('buildReviewCreateData', () => {
  it('maps normalized ratings onto every rating column', () => {
    const data = buildReviewCreateData({
      userId: 'u1', placeId: 'p1', ratings, text: 'great', dishName: 'Fries',
      tags: ['crispy'], photoIds: ['ph1'],
    })
    expect(data).toMatchObject({
      userId: 'u1',
      placeId: 'p1',
      rating: 3.5,
      ratingTaste: 4,
      ratingValue: 5,
      ratingPortion: 3,
      ratingService: 2,
      ratingOverall: 3.5,
      text: 'great',
      dishName: 'Fries',
    })
  })

  it('attaches photos in order via sortOrder', () => {
    const data = buildReviewCreateData({
      userId: 'u1', placeId: 'p1', ratings, text: 't', dishName: undefined,
      tags: [], photoIds: ['a', 'b', 'c'],
    })
    expect(data.reviewPhotos).toEqual({
      create: [
        { photoId: 'a', sortOrder: 0 },
        { photoId: 'b', sortOrder: 1 },
        { photoId: 'c', sortOrder: 2 },
      ],
    })
  })

  it('omits the tags relation entirely when there are no tags', () => {
    const withTags = buildReviewCreateData({
      userId: 'u', placeId: 'p', ratings, text: 't', dishName: undefined, tags: ['x'], photoIds: ['ph'],
    })
    expect(withTags.tags).toEqual({ createMany: { data: [{ tag: 'x' }] } })

    const noTags = buildReviewCreateData({
      userId: 'u', placeId: 'p', ratings, text: 't', dishName: undefined, tags: [], photoIds: ['ph'],
    })
    expect(noTags.tags).toBeUndefined()
  })
})

describe('buildReviewUpdateData', () => {
  it('uses the full ratings object when ratings were sent', () => {
    const data = buildReviewUpdateData({
      hasRatings: true, normalizedRatings: ratings, singleRating: undefined,
      filteredText: undefined, hasDishName: false, normalizedDishName: undefined,
    })
    expect(data).toMatchObject({
      rating: 3.5, ratingTaste: 4, ratingValue: 5, ratingPortion: 3, ratingService: 2, ratingOverall: 3.5,
    })
  })

  it('fans a single legacy rating across all dimensions and clears service', () => {
    const data = buildReviewUpdateData({
      hasRatings: false, normalizedRatings: null, singleRating: 4,
      filteredText: undefined, hasDishName: false, normalizedDishName: undefined,
    })
    expect(data).toMatchObject({
      rating: 4, ratingTaste: 4, ratingValue: 4, ratingPortion: 4, ratingService: null, ratingOverall: 4,
    })
  })

  it('leaves ratings untouched when neither ratings nor a single rating were sent', () => {
    const data = buildReviewUpdateData({
      hasRatings: false, normalizedRatings: null, singleRating: undefined,
      filteredText: 'new text', hasDishName: false, normalizedDishName: undefined,
    })
    expect(data.rating).toBeUndefined()
    expect(data.ratingOverall).toBeUndefined()
    expect(data.text).toBe('new text')
  })

  it('only includes text when it was provided', () => {
    expect(buildReviewUpdateData({
      hasRatings: false, normalizedRatings: null, singleRating: undefined,
      filteredText: undefined, hasDishName: false, normalizedDishName: undefined,
    }).text).toBeUndefined()
  })

  it('includes dishName (even when cleared to undefined) only when the field was sent', () => {
    // Field sent → key present.
    const sent = buildReviewUpdateData({
      hasRatings: false, normalizedRatings: null, singleRating: undefined,
      filteredText: undefined, hasDishName: true, normalizedDishName: 'Soup',
    })
    expect(sent).toHaveProperty('dishName', 'Soup')

    // Field absent → key omitted, so an unrelated update never wipes the dish name.
    const absent = buildReviewUpdateData({
      hasRatings: false, normalizedRatings: null, singleRating: undefined,
      filteredText: 'x', hasDishName: false, normalizedDishName: undefined,
    })
    expect(absent).not.toHaveProperty('dishName')
  })
})
