import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const COUNTRY_NAMES = new Set([
  'nederland', 'netherlands', 'the netherlands', 'belgium', 'belgië', 'belgique', 'germany', 'duitsland', 'france', 'frankrijk',
])

/**
 * Extracts the city from an address string.
 * Handles: "Straatnaam 1, 1234 AB Amsterdam" → "Amsterdam"
 * Handles: "Straatnaam 1, Amsterdam, Nederland" → "Amsterdam"
 */
export function extractCity(address: string): string | null {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)

  // Walk from the end, skip country names
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]
    if (COUNTRY_NAMES.has(part.toLowerCase())) continue
    // Strip Dutch/Belgian postal code prefix (e.g. "1234 AB ")
    const city = part.replace(/^\d{4}\s?[A-Za-z]{0,2}\s+/, '').trim()
    if (city) return city
  }

  return null
}
