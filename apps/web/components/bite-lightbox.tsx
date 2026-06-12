'use client'
import { useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { photoVariantUrl } from '@/lib/photo-url'
import { mealEmoji, mealLabel } from '@/lib/meal'
import { formatDateMedium } from '@/lib/time'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

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

/** Fullscreen viewer for a bite photo with a compact info bar. Open when `bite` is set and has a displayable photo variant. */
export function BiteLightbox({ bite, onClose }: BiteLightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  // Remember what had focus so we can restore it when the lightbox closes.
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const src = bite ? photoVariantUrl(bite.photo.variants, ['large', 'medium', 'thumb']) : null
  const open = src !== null

  const focusables = useCallback(
    () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
    [],
  )

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    // Focus the first focusable element (or the dialog itself) on open.
    const first = focusables()[0] ?? dialogRef.current
    first?.focus()

    // Lock background scroll while the lightbox is open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      // Trap focus: cycle Tab/Shift+Tab within the dialog's focusables.
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      const active = document.activeElement

      if (e.shiftKey && active === firstItem) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      previouslyFocused.current?.focus()
    }
  }, [open, onClose, focusables])

  if (!bite || !src) return null
  const label = mealLabel(bite.mealSlot)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onMouseDown={(e) => {
        // Only a press that starts on the backdrop closes the lightbox —
        // a drag that starts on content (e.g. selecting the note text) and
        // ends on the backdrop must not dismiss it.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${label} bite photo viewer`}
        tabIndex={-1}
        className="max-h-full max-w-full outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-2xl text-white transition hover:bg-white/10"
          aria-label="Close photo viewer"
        >
          ×
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- user photo via variant URL */}
        <img
          src={src}
          alt={bite.note ?? `${label} bite`}
          className="max-h-[75vh] max-w-full rounded-2xl object-contain"
        />
        <div className="mt-3 max-w-[90vw] text-sm text-white">
          <p className="font-medium">
            <span aria-hidden="true">{mealEmoji(bite.mealSlot)}</span> {label}
            <span className="ml-2 text-white/70">{formatDateMedium(bite.createdAt)}</span>
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
