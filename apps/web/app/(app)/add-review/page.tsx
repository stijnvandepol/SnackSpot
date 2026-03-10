'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { UserMentionInput } from '@/components/user-mention-input'
import { computeOverallRating } from '@/lib/ratings'
import { REVIEW_TAG_OPTIONS, type ReviewTag } from '@/lib/review-tags'
import { shouldUseDirectBrowserUpload } from '@/lib/upload'

type Step = 'place' | 'review' | 'photos'

interface PlaceForm {
  mode: 'new' | 'existing'
  placeId?: string
  name: string
  address: string
  lat: string
  lng: string
}

interface SearchPlace {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  distance_m?: number
  avg_rating: number | null
  review_count: number
}

interface UploadedPhoto {
  photoId: string
  previewUrl: string
  status: 'uploading' | 'confirming' | 'ready' | 'error'
}

interface RatingDraft {
  taste: number
  value: number
  portion: number
  service: number | null
}

const MIME_ALIASES: Record<string, 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'image/heic'> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-jpeg': 'image/jpeg',
  'image/jfif': 'image/jpeg',
  'image/png': 'image/png',
  'image/x-png': 'image/png',
  'image/webp': 'image/webp',
  'image/avif': 'image/avif',
  'image/heic': 'image/heic',
  'image/heif': 'image/heic',
  'image/heic-sequence': 'image/heic',
  'image/heif-sequence': 'image/heic',
}

function normalizeUploadMime(file: File): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'image/heic' | null {
  const rawType = (file.type || '').trim().toLowerCase()
  if (rawType in MIME_ALIASES) return MIME_ALIASES[rawType]

  const name = (file.name || '').toLowerCase()
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.avif')) return 'image/avif'
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heic'

  return null
}

function createTempPhotoId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function isHalfStepRating(value: number): boolean {
  return value >= 1 && value <= 5 && Math.abs(value * 2 - Math.round(value * 2)) < Number.EPSILON
}

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className="relative inline-flex">
          <button
            type="button"
            className="absolute inset-y-0 left-0 z-10 w-1/2"
            aria-label={`Set ${s - 0.5} stars`}
            onClick={() => onChange(s - 0.5)}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 z-10 w-1/2"
            aria-label={`Set ${s} stars`}
            onClick={() => onChange(s)}
          />
          <span
            className={`pointer-events-none text-4xl ${
              value >= s ? 'text-snack-rating' : value === s - 0.5 ? 'text-snack-rating/60' : 'text-[#dfdfdf]'
            }`}
          >
            ★
          </span>
        </div>
      ))}
      {value >= 1 && <span className="ml-2 text-sm font-semibold text-snack-text">{value.toFixed(1)}</span>}
    </div>
  )
}

export default function AddReviewPage() {
  const { user, accessToken, loading } = useAuth()
  const router = useRouter()
  const isDev = process.env.NODE_ENV !== 'production'
  const [step, setStep] = useState<Step>('place')
  const [place, setPlace] = useState<PlaceForm>({
    mode: 'existing', name: '', address: '', lat: '', lng: '',
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchPlace[]>([])
  const [searching, setSearching] = useState(false)
  const [ratings, setRatings] = useState<RatingDraft>({
    taste: 3,
    value: 3,
    portion: 3,
    service: null,
  })
  const [text, setText] = useState('')
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const [dishName, setDishName] = useState('')
  const [selectedTags, setSelectedTags] = useState<ReviewTag[]>([])
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchingLocation, setFetchingLocation] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const photosRef = useRef<UploadedPhoto[]>([])

  const revokePreviewUrl = (url: string) => {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }

  // Search for existing places
  const handleSearchPlaces = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }
    
    setSearching(true)
    try {
      const res = await fetch(
        `/api/v1/places/search?q=${encodeURIComponent(query)}&limit=10`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Search failed')
      const json = await res.json()
      setSearchResults(json.data.data || [])
    } catch (e) {
      console.error('Place search failed:', e)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => revokePreviewUrl(photo.previewUrl))
    }
  }, [])

  // Debounced search
  const handleSearchInputChange = (query: string) => {
    setSearchQuery(query)
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      handleSearchPlaces(query)
    }, 300)
  }

  // Select a place from search results
  const handleSelectPlace = (selectedPlace: SearchPlace) => {
    setPlace((p) => ({
      ...p,
      placeId: selectedPlace.id,
      name: selectedPlace.name,
      address: selectedPlace.address,
      lat: selectedPlace.lat.toString(),
      lng: selectedPlace.lng.toString(),
    }))
    setSearchQuery(selectedPlace.name)
    setSearchResults([])
  }

  // Get current location and reverse geocode to address
  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }
    
    setFetchingLocation(true)
    setError(null)
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        
        if (isDev) console.log('Current position:', lat, lng)
        
        try {
          // Add small delay to respect Nominatim usage policy
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Reverse geocode: coordinates -> address
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
            { 
              headers: { 
                'User-Agent': 'SnackSpot/1.0 (contact@snackspot.app)',
                'Accept-Language': 'nl,en'
              } 
            }
          )
          
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`)
          }
          
          const data = await res.json()
          if (isDev) console.log('Reverse geocoding result:', data)
          
          if (data.address) {
            const addr = data.address
            // Build a clean "Street HouseNumber, City" address from components
            const street = [addr.road, addr.house_number].filter(Boolean).join(' ')
            const city = addr.city || addr.town || addr.village || addr.municipality || ''
            const parts = [street, city].filter(Boolean)
            const addressStr = parts.length > 0 ? parts.join(', ') : data.display_name
            
            setPlace((p) => ({
              ...p,
              address: addressStr,
              lat: lat.toString(),
              lng: lng.toString(),
            }))
          } else {
            // Still set coordinates even if address lookup failed
            setPlace((p) => ({ 
              ...p, 
              lat: lat.toString(), 
              lng: lng.toString() 
            }))
            setError('Got your location! Please enter the address manually.')
          }
        } catch (e) {
          console.error('Reverse geocoding failed:', e)
          // Still set coordinates
          setPlace((p) => ({ 
            ...p, 
            lat: lat.toString(), 
            lng: lng.toString() 
          }))
          setError('Got your location! Please enter the address manually.')
        } finally {
          setFetchingLocation(false)
        }
      },
      (err) => {
        console.error('Geolocation error:', err)
        setError(`Location error: ${err.message}`)
        setFetchingLocation(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }

  // Geocode address to get coordinates
  const handleGeocodeAddress = async () => {
    if (!place.address || place.address.length < 3) {
      return // Don't geocode very short text
    }
    
    setGeocoding(true)
    setError(null)
    
    try {
      // Add small delay to respect Nominatim usage policy
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place.address)}&format=json&addressdetails=1&limit=3&countrycodes=nl,be,de`,
        { 
          headers: { 
            'User-Agent': 'SnackSpot/1.0 (contact@snackspot.app)',
            'Accept-Language': 'nl,en'
          } 
        }
      )
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      
      const data = await res.json()
      if (isDev) console.log('Geocoding results:', data)
      
      if (data && data.length > 0) {
        const result = data[0]
        // Build a clean "Street HouseNumber, City" address from components
        let cleanAddress = place.address
        if (result.address) {
          const addr = result.address
          const street = [addr.road, addr.house_number].filter(Boolean).join(' ')
          const city = addr.city || addr.town || addr.village || addr.municipality || ''
          const parts = [street, city].filter(Boolean)
          if (parts.length > 0) cleanAddress = parts.join(', ')
        }
        setPlace((p) => ({
          ...p,
          lat: result.lat,
          lng: result.lon,
          address: cleanAddress,
        }))
        if (isDev) console.log('Coordinates found:', result.lat, result.lon)
      } else {
        if (isDev) console.warn('No results for address:', place.address)
        setError('Address not found. Try a more specific address (e.g., "Dam 1, Amsterdam")')
      }
    } catch (e) {
      console.error('Geocoding error:', e)
      setError(`Could not pin address: ${e instanceof Error ? e.message : 'Unknown error'}. Try again or use current location.`)
    } finally {
      setGeocoding(false)
    }
  }

  if (loading) return null

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-semibold text-snack-text">Please log in to add a review.</p>
        <a href="/auth/login" className="btn-primary mt-4 inline-block">Log in</a>
      </div>
    )
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return
    if (!accessToken) {
      setError('Your session is not ready yet. Please wait a moment and try again.')
      return
    }
    const remaining = 5 - photos.length
    const toUpload = Array.from(files).slice(0, remaining)

    // Upload sequentially for better reliability on mobile browsers.
    for (const file of toUpload) {
      const normalizedMime = normalizeUploadMime(file)
      if (!normalizedMime) {
        setError(`Unsupported image type for ${file.name || 'selected file'}. Use JPG, PNG, WEBP, AVIF or HEIC.`)
        continue
      }

      const previewUrl = URL.createObjectURL(file)
      const tempId = createTempPhotoId()
      // realId starts as the temp UUID and gets updated to the DB photo ID after initiate-upload.
      // This allows the catch block to always find the correct photo entry regardless of when the error occurs.
      let realId = tempId

      setPhotos((prev) => [...prev, { photoId: tempId, previewUrl, status: 'uploading' }])

      try {
        // 1. Initiate
        if (isDev) console.log(`[Upload] Initiating upload for ${file.name} (${(file.size / 1024).toFixed(1)}KB)`)
        const initRes = await fetch('/api/v1/photos/initiate-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ filename: file.name, contentType: normalizedMime, size: file.size }),
        })
        if (!initRes.ok) {
          const errorData = await initRes.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(`Initiate failed: ${errorData.error || initRes.statusText}`)
        }
        const { data: initData } = await initRes.json()
        realId = initData.photoId
        if (isDev) console.log(`[Upload] Got upload URL, uploading to MinIO...`)

        // 2. PUT directly to MinIO (preferred path)
        let uploaded = false
        const uploadStartTime = Date.now()
        if (shouldUseDirectBrowserUpload(initData.uploadUrl)) {
          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 5000)
            let putRes: Response
            try {
              putRes = await fetch(initData.uploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': normalizedMime },
                signal: controller.signal,
              })
            } finally {
              clearTimeout(timeout)
            }
            if (putRes.ok) {
              uploaded = true
            } else if (isDev) {
              console.warn(`[Upload] Direct MinIO upload failed: ${putRes.status} ${putRes.statusText}; trying fallback`)
            }
          } catch (directErr) {
            if (isDev) console.warn('[Upload] Direct MinIO upload blocked; trying fallback', directErr)
          }
        } else if (isDev) {
          console.log('[Upload] Same-origin upload detected; using fallback route')
        }

        // Fallback path: upload through same-origin API to avoid browser CORS/mixed-content issues.
        if (!uploaded) {
          const fallbackRes = await fetch(`/api/v1/photos/upload-fallback?photoId=${encodeURIComponent(initData.photoId)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': normalizedMime },
            body: file,
          })
          if (!fallbackRes.ok) {
            const fallbackErr = await fallbackRes.json().catch(() => ({ error: fallbackRes.statusText }))
            throw new Error(`Upload fallback failed: ${fallbackErr.error || fallbackRes.statusText}`)
          }
          uploaded = true
        }

        const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(1)
        if (isDev) console.log(`[Upload] Upload completed in ${uploadDuration}s, confirming...`)

        // 3. Confirm
        setPhotos((prev) => prev.map((p) => p.photoId === tempId ? { ...p, photoId: realId, status: 'confirming' } : p))

        const confirmRes = await fetch('/api/v1/photos/confirm-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ photoId: realId }),
        })
        if (!confirmRes.ok) {
          const errorData = await confirmRes.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(`Confirm failed: ${errorData.error || confirmRes.statusText}`)
        }
        if (isDev) console.log(`[Upload] ✓ ${file.name} uploaded successfully`)

        setPhotos((prev) =>
          prev.map((p) => p.photoId === tempId || p.photoId === realId
            ? { ...p, photoId: realId, status: 'ready' }
            : p,
          ),
        )
      } catch (err) {
        console.error(`[Upload] ✗ ${file.name} failed:`, err)
        const msg =
          err instanceof Error && /Failed to fetch|NetworkError|CORS|Mixed Content/i.test(err.message)
            ? 'Upload blocked before reaching the server. Check the upload proxy/network path.'
            : err instanceof Error
              ? err.message
              : 'Photo upload failed'
        setError(msg)
        // Match on both tempId and realId: before initiate-upload the photo still has tempId,
        // after it has realId. Using both ensures the error state is always set correctly.
        setPhotos((prev) => prev.map((p) => (p.photoId === tempId || p.photoId === realId) ? { ...p, status: 'error' } : p))
      }
    }
  }

  const handleSubmit = async () => {
    if (!isHalfStepRating(ratings.taste) || !isHalfStepRating(ratings.value) || !isHalfStepRating(ratings.portion)) {
      setError('Choose ratings from 1 to 5 in steps of 0.5')
      return
    }
    if (ratings.service !== null && !isHalfStepRating(ratings.service)) {
      setError('Service rating must be between 1 and 5 in steps of 0.5')
      return
    }

    const readyPhotos = photos.filter((p) => p.status === 'ready')
    if (readyPhotos.length === 0) { setError('At least one photo is required'); return }
    if (text.length < 10) { setError('Review text must be at least 10 characters'); return }
    setError(null)
    setSubmitting(true)

    const payload = place.mode === 'existing'
      ? {
          placeId: place.placeId,
          ratings,
          text,
          dishName: dishName || undefined,
          tags: selectedTags,
          photoIds: photos.filter((p) => p.status === 'ready').map((p) => p.photoId),
          mentionedUserIds,
        }
      : {
          place: {
            name: place.name,
            address: place.address,
            lat: parseFloat(place.lat),
            lng: parseFloat(place.lng),
          },
          ratings,
          text,
          dishName: dishName || undefined,
          tags: selectedTags,
          photoIds: photos.filter((p) => p.status === 'ready').map((p) => p.photoId),
          mentionedUserIds,
        }

    try {
      const res = await fetch('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to submit review'); return }
      router.push(`/review/${json.data.id}`)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-2xl font-heading font-bold text-snack-text mb-6">Create Post</h1>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {(['place', 'review', 'photos'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step === s ? 'bg-snack-primary text-white' : i < ['place','review','photos'].indexOf(step) ? 'bg-snack-accent text-snack-text' : 'bg-snack-surface text-snack-muted'
            }`}>
              {i + 1}
            </div>
            {i < 2 && <div className="flex-1 h-0.5 bg-[#e6e6e6] w-8" />}
          </div>
        ))}
      </div>

      {/* Step 1: Place */}
      {step === 'place' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPlace((p) => ({ ...p, mode: 'existing', placeId: undefined, name: '', address: '', lat: '', lng: '' }))
                setSearchQuery('')
                setSearchResults([])
              }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${place.mode === 'existing' ? 'border-snack-primary bg-snack-surface text-snack-primary' : 'border-[#e4e4e4] text-snack-muted'}`}
            >
              📍 Existing place
            </button>
            <button
              onClick={() => {
                setPlace((p) => ({ ...p, mode: 'new', placeId: undefined, name: '', address: '', lat: '', lng: '' }))
                setSearchQuery('')
                setSearchResults([])
              }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${place.mode === 'new' ? 'border-snack-primary bg-snack-surface text-snack-primary' : 'border-[#e4e4e4] text-snack-muted'}`}
            >
              ➕ New place
            </button>
          </div>

          {place.mode === 'existing' ? (
            <>
              <div className="relative">
                <label className="label">Search for a place *</label>
                <input 
                  className="input" 
                  placeholder="Start typing place name..." 
                  value={searchQuery} 
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  autoComplete="off"
                />
                {searching && (
                  <div className="absolute right-3 top-10 text-snack-muted">
                    🔍...
                  </div>
                )}
                
                {/* Search results dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-snack-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => handleSelectPlace(result)}
                        className="w-full text-left px-4 py-3 hover:bg-snack-surface border-b border-snack-border last:border-b-0 transition"
                      >
                        <div className="font-medium text-snack-text">{result.name}</div>
                        <div className="text-xs text-snack-muted mt-0.5">{result.address}</div>
                        <div className="flex gap-3 mt-1 text-xs text-snack-muted">
                          {result.avg_rating && (
                            <span>⭐ {result.avg_rating.toFixed(1)}</span>
                          )}
                          <span>📝 {result.review_count} reviews</span>
                          {result.distance_m !== undefined && (
                            <span>📍 {(result.distance_m / 1000).toFixed(1)} km</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {place.placeId && (
                <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">✓</span>
                    <div className="flex-1">
                      <div className="font-medium text-snack-text">{place.name}</div>
                      <div className="text-xs text-snack-muted mt-0.5">{place.address}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="label">Place name *</label>
                <input 
                  className="input" 
                  placeholder="e.g. Café Stroopwafel" 
                  value={place.name} 
                  onChange={(e) => setPlace((p) => ({ ...p, name: e.target.value }))}
                  autoComplete="off"
                />
              </div>
              
              <div>
                <label className="label">Address *</label>
                <div className="flex gap-2">
                  <input 
                    className="input flex-1" 
                    placeholder="Street, City" 
                    value={place.address} 
                    onChange={(e) => setPlace((p) => ({ ...p, address: e.target.value }))} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void handleGeocodeAddress()
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleGeocodeAddress}
                    disabled={geocoding || !place.address}
                    className="btn-secondary px-3 whitespace-nowrap"
                  >
                    {geocoding ? 'Pin...' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={fetchingLocation}
                    className="btn-secondary px-3 whitespace-nowrap"
                  >
                    {fetchingLocation ? '📍...' : 'Use current location'}
                  </button>
                </div>
                <p className="text-xs text-snack-muted mt-1">
                  Type an address and press Enter/Pin, or use your current location.
                </p>
              </div>
              
              {place.lat && place.lng && (
                <div className="px-3 py-2 bg-snack-surface rounded-lg text-xs text-snack-muted">
                  📍 Coordinates: {parseFloat(place.lat).toFixed(4)}, {parseFloat(place.lng).toFixed(4)}
                </div>
              )}
            </>
          )}

          <button
            className="btn-primary w-full mt-2"
            disabled={geocoding || fetchingLocation || searching}
            onClick={async () => {
              if (place.mode === 'existing') {
                if (!place.placeId) {
                  setError('Please select a place from the search results'); return
                }
              } else {
                // mode === 'new'
                if (!place.name || !place.address) {
                  setError('Place name and address are required'); return
                }
                if (!place.lat || !place.lng) {
                  setError('Please pin the address (Enter/Pin) or use your current location first')
                  return
                }
              }
              setError(null)
              setStep('review')
            }}
          >
            {geocoding || fetchingLocation || searching ? 'Loading...' : 'Next: Write Review →'}
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {/* Step 2: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          <div>
            <label className="label">Taste *</label>
            <Stars value={ratings.taste} onChange={(value) => setRatings((prev) => ({ ...prev, taste: value }))} />
          </div>
          <div>
            <label className="label">Value / Price *</label>
            <Stars value={ratings.value} onChange={(value) => setRatings((prev) => ({ ...prev, value }))} />
          </div>
          <div>
            <label className="label">Portion *</label>
            <Stars value={ratings.portion} onChange={(value) => setRatings((prev) => ({ ...prev, portion: value }))} />
          </div>
          <div>
            <label className="label">Service (optional)</label>
            <div className="flex items-center gap-3">
              <Stars value={ratings.service ?? 0} onChange={(value) => setRatings((prev) => ({ ...prev, service: value }))} />
              <button
                type="button"
                className="btn-secondary text-xs py-1 px-2"
                onClick={() => setRatings((prev) => ({ ...prev, service: null }))}
              >
                Not set
              </button>
            </div>
          </div>
          <div className="px-3 py-2 bg-snack-surface rounded-lg text-sm text-snack-text">
            Overall rating: <span className="font-semibold">{computeOverallRating(ratings).toFixed(1)}</span>
          </div>
          <div>
            <label className="label">Dish name</label>
            <input className="input" placeholder="e.g. Stroopwafel, Herring" value={dishName} onChange={(e) => setDishName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="label mb-0">Post tags</label>
              <span className="text-xs text-snack-muted">{selectedTags.length}/6</span>
            </div>
            <p className="mt-1 text-xs text-snack-muted">Add a few tags so Explore can surface the right kind of spot.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {REVIEW_TAG_OPTIONS.map((option) => {
                const isActive = selectedTags.includes(option.value)

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSelectedTags((prev) => {
                        if (prev.includes(option.value)) {
                          return prev.filter((tag) => tag !== option.value)
                        }
                        if (prev.length >= 6) {
                          return prev
                        }
                        return [...prev, option.value]
                      })
                    }}
                    className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                      isActive
                        ? 'border-snack-primary bg-snack-primary text-white'
                        : 'border-snack-border bg-white text-snack-muted hover:border-snack-primary hover:text-snack-primary'
                    }`}
                    title={option.hint}
                    aria-pressed={isActive}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="label">Your review * <span className="text-snack-muted font-normal">({text.length}/2000)</span></label>
            <UserMentionInput
              value={text}
              onChange={(newText, mentionedIds) => {
                setText(newText)
                setMentionedUserIds(mentionedIds)
              }}
              placeholder="Tell people what you loved (or didn't)… Use @username to mention someone"
              className="input min-h-[140px] resize-none"
              maxLength={2000}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setStep('place')}>← Back</button>
            <button
              className="btn-primary flex-1"
              onClick={() => {
                if (text.length < 10) { setError('Review text must be at least 10 characters'); return }
                setError(null)
                setStep('photos')
              }}
            >
              Next: Add Photos →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Photos */}
      {step === 'photos' && (
        <div className="space-y-4">
          <p className="text-sm text-snack-muted">Add up to 5 photos (optional).</p>

          <input
            id="review-photo-input"
            ref={fileInputRef}
            type="file"
            accept="image/*,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif"
            multiple
            className="sr-only"
            onChange={(e) => {
              void handleFileSelect(e.target.files)
              e.currentTarget.value = ''
            }}
          />

          {photos.length < 5 && (
            <label
              htmlFor="review-photo-input"
              className="btn-secondary block w-full cursor-pointer text-center"
            >
              Add photos ({photos.length}/5)
            </label>
          )}

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.photoId} className="relative aspect-square rounded-xl overflow-hidden bg-snack-surface">
                  <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                  <div className={`absolute inset-0 flex items-center justify-center ${p.status !== 'ready' ? 'bg-black/40' : 'opacity-0'}`}>
                    {p.status === 'uploading' || p.status === 'confirming'
                      ? <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : p.status === 'error' && <span className="text-white text-sm font-semibold">Error</span>
                    }
                  </div>
                  <button
                    className="absolute top-1 right-1 h-6 w-6 bg-black/50 rounded-full text-white text-xs flex items-center justify-center"
                    onClick={() => {
                      revokePreviewUrl(p.previewUrl)
                      setPhotos((prev) => prev.filter((x) => x.photoId !== p.photoId))
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {photos.filter((p) => p.status === 'ready').length === 0 && photos.length > 0 && (
            <p className="text-xs text-snack-muted">Waiting for photos to upload...</p>
          )}

          {photos.length === 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
              <p className="text-sm text-blue-900 font-medium">At least one photo is required</p>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setStep('review')}>← Back</button>
            <button
              className="btn-primary flex-1"
              onClick={handleSubmit}
              disabled={submitting || photos.filter((p) => p.status === 'ready').length === 0 || photos.some((p) => p.status === 'uploading' || p.status === 'confirming')}
            >
              {submitting ? 'Submitting…' : '✓ Submit Review'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
