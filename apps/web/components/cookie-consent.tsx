'use client'
import { useEffect, useState } from 'react'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem('cookie-consent')) setVisible(true)
    } catch {
      // localStorage blocked (private mode etc.) — skip banner
    }
  }, [])

  const dismiss = (choice: 'accepted' | 'declined') => {
    try {
      localStorage.setItem('cookie-consent', choice)
    } catch {
      // ignore
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 md:bottom-4 md:left-auto md:right-4 md:max-w-sm">
      <div className="card p-4 shadow-lg border border-snack-border">
        <p className="text-sm font-semibold text-snack-text mb-1">Cookies</p>
        <p className="text-xs text-snack-muted mb-3">
          We use one session cookie to keep you
          logged in. No tracking or advertising cookies.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => dismiss('accepted')}
            className="btn-primary text-xs py-1.5 px-3 flex-1"
          >
            Accept
          </button>
          <button
            onClick={() => dismiss('declined')}
            className="btn-secondary text-xs py-1.5 px-3 flex-1"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  )
}
