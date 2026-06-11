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
          A dish at a place, with photos and ratings. Public and permanent — it puts the spot on
          the map and helps others choose.
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
          <span className="rounded-full bg-snack-surface px-2.5 py-0.5 text-xs font-semibold text-snack-muted">24h · +10 XP</span>
        </span>
        <span className="mt-1 block text-sm text-snack-muted">
          A quick photo of what you&apos;re eating right now. Friends see it for 24 hours, then
          it&apos;s gone from their feed. Keeps your streak alive.
        </span>
      </Link>
    </>
  )
}
