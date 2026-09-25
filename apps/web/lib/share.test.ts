import { describe, it, expect } from 'vitest'
import {
  buildReviewShareText,
  buildReviewShareTitle,
  formatShareRating,
  reviewShareCardPath,
  reviewSharePath,
  whatsappShareHref,
} from './share'

describe('formatShareRating', () => {
  it('uses a Dutch decimal comma', () => {
    expect(formatShareRating(4.5)).toBe('4,5')
  })

  it('drops the decimal for whole numbers', () => {
    expect(formatShareRating(5)).toBe('5')
    expect(formatShareRating(4.0)).toBe('4')
  })

  it('rounds to one decimal', () => {
    expect(formatShareRating(4.25)).toBe('4,3')
    expect(formatShareRating(3.96)).toBe('4')
  })
})

describe('buildReviewShareText', () => {
  it('names the dish, the place and the city', () => {
    expect(
      buildReviewShareText({ dishName: 'Kapsalon', placeName: 'Cafetaria De Smickel', city: 'Uden', rating: 4.5 }),
    ).toBe('Kapsalon bij Cafetaria De Smickel in Uden: 4,5 ★ op SnackSpot')
  })

  it('falls back to the place alone when there is no dish', () => {
    expect(buildReviewShareText({ placeName: 'Cafetaria De Smickel', city: 'Uden', rating: 4 })).toBe(
      'Cafetaria De Smickel in Uden: 4 ★ op SnackSpot',
    )
  })

  it('omits the city when it is unknown', () => {
    expect(buildReviewShareText({ dishName: 'Friet', placeName: 'Frituur Jan', city: null, rating: 3.5 })).toBe(
      'Friet bij Frituur Jan: 3,5 ★ op SnackSpot',
    )
  })

  it('treats a blank dish name as absent', () => {
    expect(buildReviewShareText({ dishName: '   ', placeName: 'Frituur Jan', rating: 5 })).toBe(
      'Frituur Jan: 5 ★ op SnackSpot',
    )
  })
})

describe('buildReviewShareTitle', () => {
  it('pairs dish and place', () => {
    expect(buildReviewShareTitle({ dishName: 'Kapsalon', placeName: 'De Smickel', rating: 4 })).toBe(
      'Kapsalon bij De Smickel',
    )
  })

  it('is the place name without a dish', () => {
    expect(buildReviewShareTitle({ placeName: 'De Smickel', rating: 4 })).toBe('De Smickel')
  })
})

describe('paths', () => {
  it('builds the canonical review path without back-navigation context', () => {
    expect(reviewSharePath('abc123')).toBe('/review/abc123')
  })

  it('builds the card path under the review', () => {
    expect(reviewShareCardPath('abc123')).toBe('/review/abc123/card.jpg')
  })

  it('URL-encodes the id', () => {
    expect(reviewSharePath('a b')).toBe('/review/a%20b')
  })
})

describe('whatsappShareHref', () => {
  it('prefills text and URL on separate lines', () => {
    const href = whatsappShareHref('Kapsalon: 4,5 ★', 'https://snackspot.online/review/abc')
    expect(href.startsWith('https://wa.me/?text=')).toBe(true)
    const text = decodeURIComponent(href.slice('https://wa.me/?text='.length))
    expect(text).toBe('Kapsalon: 4,5 ★\nhttps://snackspot.online/review/abc')
  })
})
