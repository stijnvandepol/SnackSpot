import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Parts to skip when extracting the city
const SKIP_PARTS = new Set([
  'nederland', 'netherlands', 'the netherlands',
  'belgium', 'belgië', 'belgique',
  'germany', 'duitsland', 'france', 'frankrijk', 'luxembourg', 'luxemburg',
  // Dutch provinces
  'noord-holland', 'zuid-holland', 'utrecht', 'noord-brabant', 'gelderland',
  'overijssel', 'friesland', 'fryslân', 'groningen', 'drenthe', 'zeeland',
  'limburg', 'flevoland',
])

// Standalone Dutch postal code: "5446 PJ" or "5446PJ"
const POSTAL_ONLY_RE = /^\d{4}\s?[A-Za-z]{2}$/
// Postal code at the start of a part, followed by a city name: "1234 AB Amsterdam"
const POSTAL_CITY_RE = /^\d{4}\s?[A-Za-z]{2}\s+(.+)/
// Parts that contain a digit or a common Dutch street suffix look like a street, not a city
const STREET_SUFFIX_RE = /\b(?:straat|laan|weg|plein|dijk|gracht|kade|steeg|pad|dreef|boulevard|singel|allee)\b/i

function looksLikeStreet(part: string): boolean {
  return /\d/.test(part) || STREET_SUFFIX_RE.test(part)
}

/**
 * Extracts the city from an address string.
 *
 * Handles multiple formats:
 *   "Straatnaam 1, 1234 AB Amsterdam"                          → "Amsterdam"
 *   "Straatnaam 1, Amsterdam, Nederland"                       → "Amsterdam"
 *   "Campusbaan, 6, Nijmegen"                                  → "Nijmegen"
 *   "Peelstraat, Wanroij, Land van Cuijk, Noord-Brabant, ..."  → "Wanroij"
 */
export function extractCity(address: string): string | null {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)

  // Priority: if any part is "postal code + city name", return that city immediately
  for (const part of parts) {
    const match = part.match(POSTAL_CITY_RE)
    if (match) return match[1].trim()
  }

  // Filter out countries, provinces, standalone postal codes, and pure numbers
  const candidates = parts.filter(
    (p) => !SKIP_PARTS.has(p.toLowerCase()) && !POSTAL_ONLY_RE.test(p) && !/^\d+$/.test(p),
  )

  if (candidates.length === 0) return null

  // Return the first candidate that doesn't look like a street name
  const city = candidates.find((p) => !looksLikeStreet(p))
  if (city) return city

  // Fallback: last remaining candidate (best effort)
  return candidates.at(-1) ?? null
}
