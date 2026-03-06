'use client'

import { useRouter } from 'next/navigation'

interface BackButtonProps {
  fallbackHref?: string
  label?: string
  className?: string
}

export function BackButton({
  fallbackHref = '/feed',
  label = 'Back',
  className = 'btn-secondary text-sm',
}: BackButtonProps) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back()
          return
        }
        router.push(fallbackHref)
      }}
      className={className}
      aria-label={label}
      title={label}
    >
      ← {label}
    </button>
  )
}
