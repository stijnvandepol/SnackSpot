'use client'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Modal } from '@/components/ui/modal'
import { whatsappShareHref } from '@/lib/share'

interface ShareButtonProps {
  /** Path or absolute URL of the thing being shared. A path is resolved against the current origin. */
  url: string
  /** Header of the native share sheet. */
  title: string
  /** The message that travels with the link. */
  text: string
  /** `icon`: compact glyph for card footers. `button`: labelled secondary button. `primary`: labelled CTA. */
  variant?: 'icon' | 'button' | 'primary'
  label?: string
  className?: string
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v13" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.9 11.9 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.33 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41" />
    </svg>
  )
}

/**
 * Share a URL. On devices with the Web Share API (every phone, most desktop browsers on
 * Windows/macOS) one tap opens the system sheet, where WhatsApp sits at the top for Dutch
 * users. Elsewhere a small dialog offers WhatsApp directly and "copy link".
 *
 * The dialog is portalled to <body>: cards in the feed create their own stacking context
 * (`isolate`), which would otherwise trap the fixed backdrop underneath the next card.
 */
export function ShareButton({ url, title, text, variant = 'icon', label = 'Delen', className }: ShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const absoluteUrl = () => new URL(url, window.location.origin).toString()

  const share = useCallback(async () => {
    const href = absoluteUrl()
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url: href })
        return
      } catch (error) {
        // The user dismissed the sheet: nothing else to do.
        if (error instanceof Error && error.name === 'AbortError') return
        // Any other failure (unsupported data, permission) falls through to the dialog.
      }
    }
    setCopied(false)
    setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, title, text])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl())
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const close = useCallback(() => setOpen(false), [])

  const buttonClass =
    variant === 'icon'
      ? `inline-flex items-center gap-1.5 text-sm text-snack-muted transition-colors hover:text-snack-primary ${className ?? ''}`
      : variant === 'primary'
        ? `btn-primary text-sm gap-2 ${className ?? ''}`
        : `btn-secondary text-sm gap-2 ${className ?? ''}`

  return (
    <>
      <button
        type="button"
        onClick={share}
        className={buttonClass}
        aria-label={variant === 'icon' ? `${label}: ${title}` : undefined}
        title={variant === 'icon' ? label : undefined}
      >
        <ShareIcon className={variant === 'icon' ? 'h-5 w-5' : 'h-4 w-4'} />
        {variant !== 'icon' && <span>{label}</span>}
      </button>

      {mounted &&
        open &&
        createPortal(
          <Modal open={open} onClose={close} title="Deel deze review">
            <p className="text-sm text-snack-muted">{text}</p>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href={whatsappShareHref(text, absoluteUrl())}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
                style={{ backgroundColor: '#25D366' }}
              >
                <WhatsAppIcon className="h-5 w-5" />
                Delen via WhatsApp
              </a>
              <button type="button" onClick={copy} className="btn-secondary text-sm">
                {copied ? 'Link gekopieerd ✓' : 'Kopieer link'}
              </button>
            </div>
          </Modal>,
          document.body,
        )}
    </>
  )
}
