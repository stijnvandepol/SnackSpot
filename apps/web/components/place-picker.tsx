'use client'
import { useEffect, useRef, useState } from 'react'

/** A venue returned by the verify endpoint: an existing SnackSpot place (placeId
 *  set) or a provider-verified venue the user can add (placeId null). */
interface VerifyResult {
  placeId: string | null
  provider: string
  providerPlaceId: string | null
  name: string
  address: string
  lat: number
  lng: number
  reviewCount: number
}

/** What the picker hands back to the form. Exactly one of placeId/verifiedPlace
 *  is set, mirroring the review API's accepted shapes. */
export interface PickedPlace {
  placeId?: string
  verifiedPlace?: {
    provider: string
    providerPlaceId: string
    name: string
    address: string
    lat: number
    lng: number
  }
  name: string
  address: string
}

interface PlacePickerProps {
  accessToken: string | null
  value: PickedPlace | null
  onChange: (picked: PickedPlace | null) => void
}

export function PlacePicker({ accessToken, value, onChange }: PlacePickerProps) {
  const [query, setQuery] = useState(value?.name ?? '')
  const [results, setResults] = useState<VerifyResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The user's location, used to surface nearby venues first. Opt-in.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    coordsRef.current = coords
  }, [coords])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      abortRef.current?.abort()
    }
  }, [])

  const useMyLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCoords(next)
        coordsRef.current = next
        setLocating(false)
        if (query.trim().length >= 2) void runSearch(query) // re-rank with location
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    )
  }

  const runSearch = async (q: string) => {
    if (!accessToken || q.trim().length < 2) {
      setResults([])
      return
    }
    // Cancel any in-flight request so a slow earlier response can't overwrite
    // the results of a newer query.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSearching(true)
    setError(null)
    try {
      const params = new URLSearchParams({ q })
      const c = coordsRef.current
      if (c) {
        params.set('lat', String(c.lat))
        params.set('lng', String(c.lng))
      }
      const res = await fetch(`/api/v1/places/verify?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('search failed')
      const json = await res.json()
      if (!controller.signal.aborted) setResults(json.data?.data ?? [])
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return // superseded by a newer query
      setError('Could not search places. Check your connection and try again.')
      setResults([])
    } finally {
      if (abortRef.current === controller) setSearching(false)
    }
  }

  const onInput = (q: string) => {
    setQuery(q)
    if (value) onChange(null) // typing again clears the current selection
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    // Debounce + respect Nominatim's ~1 req/s usage policy.
    timeoutRef.current = setTimeout(() => void runSearch(q), 450)
  }

  const select = (r: VerifyResult) => {
    // Existing place → reuse by id. Provider venue (placeId null) → send the
    // verified payload. providerPlaceId is always set for provider venues.
    if (r.placeId) {
      onChange({ placeId: r.placeId, name: r.name, address: r.address })
    } else if (r.providerPlaceId) {
      onChange({
        verifiedPlace: {
          provider: r.provider,
          providerPlaceId: r.providerPlaceId,
          name: r.name,
          address: r.address,
          lat: r.lat,
          lng: r.lng,
        },
        name: r.name,
        address: r.address,
      })
    }
    setQuery(r.name)
    setResults([])
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <label className="label" htmlFor="place-search">
          Find the place *
        </label>
        <p className="mb-2 text-xs text-snack-muted">
          Search for the restaurant, café or snackbar. Pick it from the list — places already on
          SnackSpot show first, so you never create a duplicate.
        </p>
        <input
          id="place-search"
          className="input"
          placeholder="Start typing a place name…"
          value={query}
          onChange={(e) => onInput(e.target.value)}
          autoComplete="off"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="place-results"
        />
        {searching && <div className="absolute right-3 top-10 text-xs text-snack-muted">🔍…</div>}

        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-snack-primary disabled:opacity-50"
        >
          <span aria-hidden="true">📍</span>
          {locating ? 'Finding you…' : coords ? 'Using your location · nearest first' : 'Search near me'}
        </button>

        {results.length > 0 && (
          <ul
            id="place-results"
            className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-snack-border bg-snack-background shadow-lg"
          >
            {results.map((r) => (
              <li key={r.placeId ?? `${r.provider}:${r.providerPlaceId}`}>
                <button
                  type="button"
                  onClick={() => select(r)}
                  className="block w-full border-b border-snack-border px-4 py-3 text-left transition last:border-b-0 hover:bg-snack-surface"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-snack-text">{r.name}</span>
                    {r.placeId ? (
                      <span className="rounded-full bg-snack-primary/10 px-2 py-0.5 text-[10px] font-semibold text-snack-primary">
                        {r.reviewCount > 0
                          ? `On SnackSpot · ${r.reviewCount} review${r.reviewCount === 1 ? '' : 's'}`
                          : 'On SnackSpot'}
                      </span>
                    ) : (
                      <span className="rounded-full bg-snack-surface px-2 py-0.5 text-[10px] font-semibold text-snack-muted">
                        Add new
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-snack-muted">{r.address}</div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!searching && query.trim().length >= 2 && results.length === 0 && !error && (
          <div className="mt-2 rounded-xl border border-dashed border-snack-border px-4 py-3 text-sm text-snack-muted">
            No place matched. Try the exact name, add the street or city, or tap{' '}
            <span className="font-medium text-snack-text">Search near me</span>.
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {value && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-950/30">
          <div className="font-medium text-snack-text">Selected: {value.name}</div>
          {value.address && <div className="mt-0.5 text-xs text-snack-muted">{value.address}</div>}
        </div>
      )}
    </div>
  )
}
