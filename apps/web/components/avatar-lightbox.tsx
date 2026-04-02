'use client'
import { useEffect, useState, MouseEvent } from 'react'
import Image from 'next/image'
import { avatarUrl } from '@/lib/avatar'

interface AvatarLightboxProps {
  avatarKey: string | null | undefined
  username: string
  size?: 'sm' | 'md' | 'lg'
}

export function AvatarLightbox({ avatarKey, username, size = 'md' }: AvatarLightboxProps) {
  const [isOpen, setIsOpen] = useState(false)

  const sizeClasses = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-8 w-8 text-xs',
    lg: 'h-16 w-16 text-2xl',
  }

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

  const avatar = avatarKey ? avatarUrl(avatarKey) : null

  return (
    <>
      <button
        type="button"
        onClick={(e: MouseEvent) => {
          if (avatar) {
            e.preventDefault()
            e.stopPropagation()
            setIsOpen(true)
          }
        }}
        className={`${sizeClasses[size]} rounded-full bg-snack-surface flex items-center justify-center text-snack-primary font-semibold uppercase flex-shrink-0 overflow-hidden ${avatar ? 'cursor-zoom-in' : ''}`}
        aria-label={avatar ? `View ${username}'s profile image` : undefined}
        disabled={!avatar}
      >
        {avatar ? (
          <span className="relative block h-full w-full">
            <Image
              src={avatar}
              alt={`${username}'s profile picture`}
              fill
              sizes="64px"
              className="object-cover"
            />
          </span>
        ) : (
          username[0]
        )}
      </button>

      {isOpen && avatar && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Profile image viewer"
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
              src={avatar}
              alt={`${username}'s profile image`}
              className="max-w-full max-h-[90vh] object-contain cursor-zoom-out rounded-2xl"
              onClick={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
