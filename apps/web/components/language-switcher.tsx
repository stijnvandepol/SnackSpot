'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LOCALE_COOKIE, type Locale } from '@/lib/i18n/locale'

const OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'nl', label: 'NL' },
]

// Writes the locale cookie client-side, then refreshes so the server re-resolves
// the dictionary. No URL change — the marketing pages read the cookie server-side.
export function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const setLocale = (locale: Locale) => {
    if (locale === current) return
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
    startTransition(() => router.refresh())
  }

  return (
    <div role="group" aria-label="Language" className="inline-flex items-center rounded-full border border-[var(--snack-border-soft)] p-0.5 text-xs">
      {OPTIONS.map((opt) => {
        const active = opt.value === current
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLocale(opt.value)}
            disabled={isPending}
            aria-pressed={active}
            className={
              active
                ? 'rounded-full bg-snack-primary px-2.5 py-1 font-semibold text-white'
                : 'rounded-full px-2.5 py-1 text-snack-muted hover:text-snack-text'
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
