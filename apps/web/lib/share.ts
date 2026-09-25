/**
 * Share helpers for reviews. Pure functions so the wording is unit-testable and lives in
 * one place: the share button, the "just posted" banner and any future channel all call
 * these, so a copy change never has to be hunted down across components.
 */

export interface ReviewShareInput {
  dishName?: string | null
  placeName: string
  city?: string | null
  /** Overall rating on the 1–5 scale. */
  rating: number
}

/** Canonical path for a review — never carries the `?from=` back-navigation context. */
export function reviewSharePath(reviewId: string): string {
  return `/review/${encodeURIComponent(reviewId)}`
}

/** Path of the 1200×630 JPEG card that og:image points at (see app/(app)/review/[id]/card.jpg). */
export function reviewShareCardPath(reviewId: string): string {
  return `${reviewSharePath(reviewId)}/card.jpg`
}

/** Dutch number formatting: 4.5 → "4,5". Whole numbers stay whole ("5" rather than "5,0"). */
export function formatShareRating(rating: number): string {
  const rounded = Math.round(rating * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
}

/**
 * The message that travels with the link. Kept to one line: WhatsApp renders the link
 * preview (photo, title, description) underneath it, so the text only needs to say what
 * the reader is about to open and give them a reason to tap.
 *
 *   "Kapsalon bij Cafetaria De Smickel in Uden: 4,5 ★ op SnackSpot"
 *   "Cafetaria De Smickel in Uden: 4,5 ★ op SnackSpot"
 */
export function buildReviewShareText(input: ReviewShareInput): string {
  const dish = input.dishName?.trim()
  const place = input.placeName.trim()
  const city = input.city?.trim()
  const where = city ? `${place} in ${city}` : place
  const subject = dish ? `${dish} bij ${where}` : where
  return `${subject}: ${formatShareRating(input.rating)} ★ op SnackSpot`
}

/** Title for the native share sheet (shown as the sheet header on iOS/Android). */
export function buildReviewShareTitle(input: ReviewShareInput): string {
  const dish = input.dishName?.trim()
  return dish ? `${dish} bij ${input.placeName.trim()}` : input.placeName.trim()
}

/**
 * WhatsApp's universal link. `wa.me/?text=` opens the app on phones and WhatsApp Web on
 * desktop, with the message prefilled and no recipient chosen. The URL goes on its own
 * line so WhatsApp reliably detects it and renders the preview.
 */
export function whatsappShareHref(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
}
