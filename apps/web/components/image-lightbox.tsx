'use client'
import { useEffect, useState, MouseEvent } from 'react'

interface ImageLightboxProps {
  src: string
  alt: string
  thumbnail: string
  className?: string
  thumbnailClassName?: string
}

export function ImageLightbox({ src, alt, thumbnail, className, thumbnailClassName }: ImageLightboxProps) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={thumbnailClassName ?? 'cursor-zoom-in'}
        aria-label={`Open ${alt} in full view`}
      >
        <img src={thumbnail} alt={alt} className={className} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition"
            aria-label="Close image viewer"
          >
            ×
          </button>
          <div className="max-w-full max-h-full" onClick={(e: MouseEvent) => e.stopPropagation()}>
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[90vh] object-contain cursor-zoom-out"
              onClick={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
