'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'

/** Convert a base64url VAPID key to the Uint8Array PushManager expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

type PushState = 'unsupported' | 'loading' | 'off' | 'on' | 'denied'

/** Push notification opt-in. The browser permission prompt only fires after an
 *  explicit tap ("two-step soft ask") — never on page load. */
export function PushSettings() {
  const { accessToken } = useAuth()
  const [state, setState] = useState<PushState>('loading')
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }

    let cancelled = false
    const init = async () => {
      try {
        const res = await fetch('/api/v1/push', { headers: { Authorization: `Bearer ${accessToken}` } })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok || !json.data?.enabled) {
          setState('unsupported') // server has no VAPID keys configured
          return
        }
        setPublicKey(json.data.publicKey)

        if (Notification.permission === 'denied') {
          setState('denied')
          return
        }

        const registration = await navigator.serviceWorker.getRegistration('/sw.js')
        const subscription = await registration?.pushManager.getSubscription()
        setState(subscription ? 'on' : 'off')
      } catch {
        if (!cancelled) setState('unsupported')
      }
    }
    void init()
    return () => { cancelled = true }
  }, [accessToken])

  const enable = async () => {
    if (!publicKey || !accessToken || busy) return
    setBusy(true)
    setError(null)
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off')
        return
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })
      const json = subscription.toJSON()
      const res = await fetch('/api/v1/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ endpoint: subscription.endpoint, keys: json.keys }),
      })
      if (!res.ok) throw new Error('Subscription could not be saved')
      setState('on')
    } catch {
      setError('Could not enable push notifications. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    if (!accessToken || busy) return
    setBusy(true)
    setError(null)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/v1/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setState('off')
    } catch {
      setError('Could not disable push notifications.')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading' || state === 'unsupported') return null

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading font-semibold text-snack-text">Push notifications</h3>
          <p className="mt-1 text-xs text-snack-muted">
            {state === 'on'
              ? 'Likes, comments, mentions and streak reminders arrive on this device.'
              : state === 'denied'
                ? 'Notifications are blocked in your browser settings for this site.'
                : 'Get a heads-up for likes, comments, mentions and streak rescues — never more than a few a day.'}
          </p>
        </div>
        {state !== 'denied' && (
          <button
            type="button"
            className={state === 'on' ? 'btn-secondary text-sm flex-shrink-0' : 'btn-primary text-sm flex-shrink-0'}
            disabled={busy}
            onClick={state === 'on' ? disable : enable}
          >
            {busy ? '...' : state === 'on' ? 'Turn off' : 'Turn on'}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
