'use client'
import { useEffect, MouseEvent } from 'react'
import Link from 'next/link'
import { photoVariantUrl } from '@/lib/photo-url'
import { mealEmoji, mealLabel } from '@/lib/meal'

export interface BiteLightboxBite {
  mealSlot: string
  createdAt: string
  note: string | null
  photo: { variants: Record<string, string> }
  place: { name: string } | null
  user?: { username: string }
}

interface BiteLightboxProps {
  bite: BiteLightboxBite | null
  onClose: () => void
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' })

/** Fullscreen viewer for a bite photo with a compact info bar. Open when `bite` is set. */
export function BiteLightbox({ bite, onClose }: BiteLightboxProps) {
  const src = bite ? photoVariantUrl(bite.photo.variants, ['large', 'medium', 'thumb']) : null
  const open = src !== null

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!bite || !src) return null
  const label = mealLabel(bite.mealSlot)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${label} bite photo viewer`}
    >
      <button
        type="button"
        onClick={(e: MouseEvent) => { e.stopPropagation(); onClose() }}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-2xl text-white transition hover:bg-white/10"
        aria-label="Close photo viewer"
      >
        ×
      </button>
      <div className="max-h-full max-w-full" onClick={(e: MouseEvent) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element -- user photo via variant URL */}
        <img
          src={src}
          alt={bite.note ?? `${label} bite`}
          className="max-h-[75vh] max-w-full rounded-2xl object-contain"
        />
        <div className="mt-3 max-w-[90vw] text-sm text-white">
          <p className="font-medium">
            <span aria-hidden="true">{mealEmoji(bite.mealSlot)}</span> {label}
            <span className="ml-2 text-white/70">{dateFormatter.format(new Date(bite.createdAt))}</span>
          </p>
          {bite.place && <p className="text-white/70">{bite.place.name}</p>}
          {bite.note && <p className="mt-1 text-white/90">{bite.note}</p>}
          {bite.user && (
            <Link
              href={`/u/${encodeURIComponent(bite.user.username)}`}
              className="mt-1 inline-block text-white/70 underline-offset-2 transition hover:text-white hover:underline"
            >
              @{bite.user.username}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
