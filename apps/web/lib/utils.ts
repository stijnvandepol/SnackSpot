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

  // Filter out countries, provinces, and standalone postal codes
  const candidates = parts.filter(
    (p) => !SKIP_PARTS.has(p.toLowerCase()) && !POSTAL_ONLY_RE.test(p),
  )

  if (candidates.length === 0) return null

  // Address structure (OSM / typical NL format):
  //   [0] street (+ house nr)   [1] house nr or suburb   [2] city   [3+] municipality, …
  // For short addresses (1–2 parts left) the city is the last remaining part.
  if (candidates.length >= 3) return candidates[2]
  if (candidates.length === 2) return candidates[1]
  return candidates[0]
}
