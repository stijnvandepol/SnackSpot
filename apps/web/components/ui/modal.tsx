'use client'
import { useCallback, useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  onClose: () => void
  /** Heading text — rendered as the dialog title and wired to aria-labelledby. */
  title: string
  children: React.ReactNode
  /** Hide the visible title but keep it for screen readers. */
  hideTitle?: boolean
}

/**
 * Accessible modal dialog: focus trap, ESC to close, backdrop click to close,
 * focus return to the trigger on close, and body scroll lock while open.
 * Centralises the markup the app previously repeated per-modal (which shipped
 * without any keyboard handling).
 */
export function Modal({ open, onClose, title, children, hideTitle }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useRef(`modal-${Math.random().toString(36).slice(2)}`).current
  // Remember what had focus so we can restore it when the modal closes.
  const previouslyFocused = useRef<HTMLElement | null>(null)

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

    // Lock background scroll while the modal is open.
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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        // Only a click that starts AND ends on the backdrop closes the modal —
        // prevents a drag that ends outside from dismissing it.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-sm card p-5 outline-none"
      >
        <h3
          id={titleId}
          className={
            hideTitle
              ? 'sr-only'
              : 'font-heading font-semibold text-snack-text mb-1'
          }
        >
          {title}
        </h3>
        {children}
      </div>
    </div>
  )
}
