'use client'
import { useEffect, useState, useCallback, useRef, MouseEvent, CSSProperties, TouchEvent } from 'react'

export interface LightboxImage {
  src: string
  thumbnail: string
  alt: string
  priority?: boolean
}

interface ImageLightboxProps {
  images: LightboxImage[]
  containerClassName?: string
  containerStyle?: CSSProperties
  itemClassName?: string
  thumbnailClassName?: string
}

export function ImageLightbox({
  images,
  containerClassName,
  containerStyle,
  itemClassName,
  thumbnailClassName,
}: ImageLightboxProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const isOpen = openIndex !== null
  const count = images.length
  const touchStartX = useRef<number | null>(null)

  const close = useCallback(() => setOpenIndex(null), [])
  const prev = useCallback(
    () => setOpenIndex((i) => (i !== null ? (i - 1 + count) % count : null)),
    [count],
  )
  const next = useCallback(
    () => setOpenIndex((i) => (i !== null ? (i + 1) % count : null)),
    [count],
  )

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, close, prev, next])

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) {
      if (dx < 0) next()
      else prev()
    }
    touchStartX.current = null
  }

  const handlePrev = useCallback(
    (e: MouseEvent) => { e.stopPropagation(); prev() },
    [prev],
  )

  const handleNext = useCallback(
    (e: MouseEvent) => { e.stopPropagation(); next() },
    [next],
  )

  const current = openIndex !== null ? images[openIndex] : null

  return (
    <>
      <div className={containerClassName} style={containerStyle}>
        {images.map((img, idx) => (
          <button
            key={img.src}
            type="button"
            onClick={() => setOpenIndex(idx)}
            className={itemClassName ?? 'cursor-zoom-in'}
            aria-label={`View ${img.alt} in full size`}
          >
            <img
              src={img.thumbnail}
              alt={img.alt}
              className={thumbnailClassName}
              loading={img.priority ? 'eager' : 'lazy'}
              fetchPriority={img.priority ? 'high' : 'auto'}
            />
          </button>
        ))}
      </div>

      {isOpen && current && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition z-10"
            aria-label="Close image viewer"
          >
            ×
          </button>

          {/* Previous button */}
          {count > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-white text-5xl w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition z-10 select-none"
              aria-label="Previous image"
            >
              ‹
            </button>
          )}

          {/* Next button */}
          {count > 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-5xl w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition z-10 select-none"
              aria-label="Next image"
            >
              ›
            </button>
          )}

          {/* Image */}
          <div
            className="max-w-full max-h-full flex items-center justify-center"
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            <img
              src={current.src}
              alt={current.alt}
              className="max-w-full max-h-[90vh] object-contain select-none"
            />
          </div>

          {/* Counter */}
          {count > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm select-none">
              {(openIndex ?? 0) + 1} / {count}
            </div>
          )}
        </div>
      )}
    </>
  )
}
