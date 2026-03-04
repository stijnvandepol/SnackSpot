'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'

type Step = 'place' | 'review' | 'photos'

interface PlaceForm {
  mode: 'new' | 'existing'
  placeId?: string
  name: string
  address: string
  lat: string
  lng: string
}

interface UploadedPhoto {
  photoId: string
  previewUrl: string
  status: 'uploading' | 'confirming' | 'ready' | 'error'
}

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          className={`text-4xl transition-transform hover:scale-110 ${s <= value ? 'text-snack-rating' : 'text-[#dfdfdf]'}`}
          onClick={() => onChange(s)}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function AddReviewPage() {
  const { user, accessToken, loading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>('place')
  const [place, setPlace] = useState<PlaceForm>({
    mode: 'new', name: '', address: '', lat: '', lng: '',
  })
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [dishName, setDishName] = useState('')
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchingLocation, setFetchingLocation] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        
        try {
          // Reverse geocode: coordinates -> address
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            { headers: { 'User-Agent': 'SnackSpot/1.0' } }
          )
          const data = await res.json()
          
          if (data.address) {
            const addr = data.address
            const street = addr.road || addr.street || ''
            const houseNumber = addr.house_number || ''
            const city = addr.city || addr.town || addr.village || ''
            const addressStr = [street, houseNumber, city].filter(Boolean).join(', ')
            
            setPlace((p) => ({
              ...p,
              address: addressStr || data.display_name,
              lat: lat.toString(),
              lng: lng.toString(),
            }))
          }
        } catch (e) {
          console.error('Reverse geocoding failed:', e)
          setError('Could not fetch address. Please enter manually.')
          setPlace((p) => ({ ...p, lat: lat.toString(), lng: lng.toString() }))
        } finally {
          setFetchingLocation(false)
        }
      },
      (err) => {
        setError(`Location error: ${err.message}`)
        setFetchingLocation(false)
      }
    )
  }

  // Geocode address to get coordinates
  const handleGeocodeAddress = async () => {
    if (!place.address) {
      setError('Please enter an address first')
      return
    }
    
    setGeocoding(true)
    setError(null)
    
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place.address)}&format=json&addressdetails=1&limit=1`,
        { headers: { 'User-Agent': 'SnackSpot/1.0' } }
      )
      const data = await res.json()
      
      if (data && data.length > 0) {
        setPlace((p) => ({
          ...p,
          lat: data[0].lat,
          lng: data[0].lon,
        }))
      } else {
        setError('Address not found. Please check the address.')
      }
    } catch (e) {
      console.error('Geocoding failed:', e)
      setError('Could not find coordinates for this address')
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
    if (!files || !accessToken) return
    const remaining = 5 - photos.length
    const toUpload = Array.from(files).slice(0, remaining)

    for (const file of toUpload) {
      const previewUrl = URL.createObjectURL(file)
      const id = crypto.randomUUID()

      setPhotos((prev) => [...prev, { photoId: id, previewUrl, status: 'uploading' }])

      try {
        // 1. Initiate
        const initRes = await fetch('/api/v1/photos/initiate-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
        })
        if (!initRes.ok) throw new Error('Failed to initiate upload')
        const { data: initData } = await initRes.json()

        // 2. PUT directly to MinIO
        await fetch(initData.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })

        // 3. Confirm
        setPhotos((prev) => prev.map((p) => p.photoId === id ? { ...p, photoId: initData.photoId, status: 'confirming' } : p))

        const confirmRes = await fetch('/api/v1/photos/confirm-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ photoId: initData.photoId }),
        })
        if (!confirmRes.ok) throw new Error('Failed to confirm upload')

        setPhotos((prev) =>
          prev.map((p) => p.photoId === id || p.photoId === initData.photoId
            ? { ...p, photoId: initData.photoId, status: 'ready' }
            : p,
          ),
        )
      } catch (err) {
        setPhotos((prev) => prev.map((p) => p.photoId === id ? { ...p, status: 'error' } : p))
      }
    }
  }

  const handleSubmit = async () => {
    if (rating === 0) { setError('Please choose a rating'); return }
    if (text.length < 10) { setError('Review text must be at least 10 characters'); return }
    setError(null)
    setSubmitting(true)

    const payload = place.mode === 'existing'
      ? {
          placeId: place.placeId,
          rating,
          text,
          dishName: dishName || undefined,
          photoIds: photos.filter((p) => p.status === 'ready').map((p) => p.photoId),
        }
      : {
          place: {
            name: place.name,
            address: place.address,
            lat: parseFloat(place.lat),
            lng: parseFloat(place.lng),
          },
          rating,
          text,
          dishName: dishName || undefined,
          photoIds: photos.filter((p) => p.status === 'ready').map((p) => p.photoId),
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
              onClick={() => setPlace((p) => ({ ...p, mode: 'new' }))}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${place.mode === 'new' ? 'border-snack-primary bg-snack-surface text-snack-primary' : 'border-[#e4e4e4] text-snack-muted'}`}
            >
              New place
            </button>
            <button
              onClick={() => setPlace((p) => ({ ...p, mode: 'existing' }))}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${place.mode === 'existing' ? 'border-snack-primary bg-snack-surface text-snack-primary' : 'border-[#e4e4e4] text-snack-muted'}`}
            >
              Existing place
            </button>
          </div>

          {place.mode === 'new' ? (
            <>
              <div>
                <label className="label">Place name *</label>
                <input className="input" placeholder="e.g. Café Stroopwafel" value={place.name} onChange={(e) => setPlace((p) => ({ ...p, name: e.target.value }))} />
              </div>
              
              <div>
                <label className="label">Address *</label>
                <div className="flex gap-2">
                  <input 
                    className="input flex-1" 
                    placeholder="Street, City" 
                    value={place.address} 
                    onChange={(e) => setPlace((p) => ({ ...p, address: e.target.value }))} 
                    onBlur={handleGeocodeAddress}
                  />
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={fetchingLocation}
                    className="btn-secondary px-3 whitespace-nowrap"
                  >
                    {fetchingLocation ? '📍...' : '📍 Current'}
                  </button>
                </div>
                <p className="text-xs text-snack-muted mt-1">
                  💡 Type address and coordinates will be fetched automatically
                </p>
              </div>
              
              {place.lat && place.lng && (
                <div className="px-3 py-2 bg-snack-surface rounded-lg text-xs text-snack-muted">
                  📍 Coordinates: {parseFloat(place.lat).toFixed(4)}, {parseFloat(place.lng).toFixed(4)}
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="label">Place ID</label>
              <input className="input" placeholder="Paste a place ID" value={place.placeId ?? ''} onChange={(e) => setPlace((p) => ({ ...p, placeId: e.target.value }))} />
              <p className="text-xs text-snack-muted mt-1">You can find the ID in the URL on a place page: /place/&lt;id&gt;</p>
            </div>
          )}

          <button
            className="btn-primary w-full mt-2"
            disabled={geocoding || fetchingLocation}
            onClick={async () => {
              if (place.mode === 'new') {
                if (!place.name || !place.address) {
                  setError('Place name and address are required'); return
                }
                // Auto-geocode if coordinates are missing
                if (!place.lat || !place.lng) {
                  await handleGeocodeAddress()
                  // Check again after geocoding
                  if (!place.lat || !place.lng) {
                    setError('Could not find coordinates for this address'); return
                  }
                }
              } else if (!place.placeId) {
                setError('Place ID is required'); return
              }
              setError(null)
              setStep('review')
            }}
          >
            {geocoding || fetchingLocation ? 'Loading...' : 'Next: Write Review →'}
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {/* Step 2: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          <div>
            <label className="label">Rating *</label>
            <Stars value={rating} onChange={setRating} />
          </div>
          <div>
            <label className="label">Dish name</label>
            <input className="input" placeholder="e.g. Stroopwafel, Herring" value={dishName} onChange={(e) => setDishName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <label className="label">Your review * <span className="text-snack-muted font-normal">({text.length}/2000)</span></label>
            <textarea
              className="input min-h-[140px] resize-none"
              placeholder="Tell people what you loved (or didn't)…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setStep('place')}>← Back</button>
            <button
              className="btn-primary flex-1"
              onClick={() => {
                if (rating === 0) { setError('Please choose a rating'); return }
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

          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />

          {photos.length < 5 && (
            <button className="btn-secondary w-full" onClick={() => fileInputRef.current?.click()}>
              Add photos ({photos.length}/5)
            </button>
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
                    onClick={() => setPhotos((prev) => prev.filter((x) => x.photoId !== p.photoId))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setStep('review')}>← Back</button>
            <button
              className="btn-primary flex-1"
              onClick={handleSubmit}
              disabled={submitting || photos.some((p) => p.status === 'uploading' || p.status === 'confirming')}
            >
              {submitting ? 'Submitting…' : '✓ Submit Review'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
