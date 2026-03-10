import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts the city from an address string.
 * Handles Dutch format: "Straatnaam 1, 1234 AB Amsterdam" → "Amsterdam"
 * Also handles: "Straatnaam 1, Amsterdam" → "Amsterdam"
 */
export function extractCity(address: string): string | null {
  const lastPart = address.split(',').pop()?.trim()
  if (!lastPart) return null
  // Strip Dutch/Belgian postal code prefix (e.g. "1234 AB " or "2000 ")
  const city = lastPart.replace(/^\d{4}\s?[A-Za-z]{0,2}\s+/, '').trim()
  return city || null
}
