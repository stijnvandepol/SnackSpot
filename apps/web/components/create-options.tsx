'use client'
import Link from 'next/link'

/** The two creation choices, shared by the mobile sheet and the desktop popover
 *  so copy/XP labels never drift between breakpoints. */
export function CreateOptions({ onPick }: { onPick?: () => void }) {
  return (
    <>
      <Link
        href="/add-review"
        onClick={onPick}
        className="block rounded-2xl border-2 border-snack-primary bg-snack-primary/10 p-4"
      >
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-heading text-lg font-bold text-snack-text">
            <span aria-hidden="true">⭐</span> Review
          </span>
          <span className="rounded-full bg-snack-primary px-2.5 py-0.5 text-xs font-semibold text-white">+75 XP</span>
        </span>
        <span className="mt-1 block text-sm text-snack-muted">
          Een gerecht bij een snackplek, met foto&apos;s en cijfers. Openbaar en blijvend: zo zet
          je de plek op de kaart en help je anderen kiezen.
        </span>
      </Link>

      <Link
        href="/add-bite"
        onClick={onPick}
        className="mt-3 block rounded-2xl border border-snack-border p-4"
      >
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-heading text-lg font-bold text-snack-text">
            <span aria-hidden="true">📸</span> Bite
          </span>
          <span className="rounded-full bg-snack-surface px-2.5 py-0.5 text-xs font-semibold text-snack-muted">24 uur · +10 XP</span>
        </span>
        <span className="mt-1 block text-sm text-snack-muted">
          Snel een foto van wat je nu eet. Vrienden zien hem 24 uur in hun feed, daarna
          verdwijnt hij. Zo houd je je reeks vast.
        </span>
      </Link>
    </>
  )
}
