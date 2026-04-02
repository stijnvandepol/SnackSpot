interface SnackSpotLogoProps {
  /** Tailwind class(es) controlling text size, e.g. "text-xl" or "text-2xl" */
  className?: string
}

/**
 * SnackSpot wordmark with the pin-drop "o" glyph.
 * Uses `text-snack-primary` and `text-snack-accent` — both theme-aware tokens.
 * Render at any size by passing a `text-*` Tailwind class via `className`.
 */
export function SnackSpotLogo({ className }: SnackSpotLogoProps) {
  return (
    <span className={['font-heading font-bold leading-none', className].filter(Boolean).join(' ')}>
      <span className="text-snack-primary">Snack</span>
      <span className="text-snack-accent inline-flex items-center">
        Sp
        <span className="inline-flex h-[0.95em] w-[0.75em] items-center justify-center align-middle">
          <svg viewBox="0 0 16 20" fill="none" className="h-[0.95em] w-[0.75em]" aria-hidden="true">
            <path d="M8 19c2.6-3.5 6-7.5 6-11a6 6 0 1 0-12 0c0 3.5 3.4 7.5 6 11Z" fill="currentColor"/>
            <circle cx="8" cy="8" r="2.25" fill="white"/>
          </svg>
        </span>
        t
      </span>
    </span>
  )
}
