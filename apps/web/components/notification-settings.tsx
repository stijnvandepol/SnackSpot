'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'

interface NotificationPreferences {
  emailOnLike: boolean
  emailOnComment: boolean
  emailOnMention: boolean
  emailOnBadge: boolean
  pushOnLike: boolean
  pushOnComment: boolean
  pushOnMention: boolean
  pushOnBadge: boolean
}

interface NotificationSettingsProps {
  embedded?: boolean
}

export function NotificationSettings({ embedded = false }: NotificationSettingsProps) {
  const { accessToken } = useAuth()
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageTone, setMessageTone] = useState<'success' | 'error' | null>(null)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (!accessToken) return

    // Check if push notifications are supported
    if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true)
      setPushPermission(Notification.permission)
    }

    // Load preferences
    const loadPreferences = async () => {
      try {
        const res = await fetch('/api/v1/me/notification-preferences', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const json = await res.json()
        if (res.ok && json.data) {
          setPreferences(json.data)
        } else {
          console.error('Failed to load notification preferences:', json.error)
        }
      } catch (error) {
        console.error('Error loading notification preferences:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPreferences()
  }, [accessToken])

  const handleSave = async () => {
    if (!accessToken || !preferences) return

    setSaving(true)
    setMessage(null)
    setMessageTone(null)

    try {
      const res = await fetch('/api/v1/me/notification-preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(preferences),
      })

      const json = await res.json()
      if (res.ok) {
        setMessage('Settings saved successfully')
        setMessageTone('success')
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage(json.error ?? 'Failed to save settings')
        setMessageTone('error')
      }
    } finally {
      setSaving(false)
    }
  }

  const requestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    try {
      const permission = await Notification.requestPermission()
      setPushPermission(permission)

      if (permission === 'granted') {
        setMessage('Push notifications enabled. You will receive notifications for new activity.')
        setMessageTone('success')
        setTimeout(() => setMessage(null), 5000)
      }
    } catch (error) {
      console.error('Failed to request push permission', error)
      setMessage('Could not enable push notifications right now.')
      setMessageTone('error')
    }
  }

  if (loading) {
    return (
      <div className={embedded ? 'rounded-xl border border-snack-border bg-white p-4' : 'card p-4'}>
        <p className="text-sm text-snack-muted">Loading settings...</p>
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className={embedded ? 'rounded-xl border border-snack-border bg-white p-4' : 'card p-4'}>
        <p className="text-sm text-snack-muted">Could not load notification settings</p>
      </div>
    )
  }

  return (
    <div className={`${embedded ? 'rounded-xl border border-snack-border bg-white p-4' : 'card p-6'} space-y-6`}>
      <div>
        {!embedded && (
          <h2 className="mb-2 text-lg font-heading font-semibold text-snack-text">
            Notification Settings
          </h2>
        )}
        <p className="text-sm text-snack-muted">
          Choose which alerts SnackSpot sends and through which channel.
        </p>
      </div>

      {pushSupported && pushPermission !== 'granted' && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-900 mb-2">Enable push notifications to receive real-time alerts.</p>
          <button
            onClick={requestPushPermission}
            className="btn-primary text-sm"
          >
            Enable Push Notifications
          </button>
        </div>
      )}

      {pushSupported && pushPermission === 'granted' && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm text-green-900">Push notifications are enabled.</p>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="font-medium text-snack-text">Email Notifications</h3>

        <label className="flex items-center justify-between gap-3 rounded-xl p-3 transition hover:bg-snack-surface cursor-pointer">
          <div>
            <p className="text-sm font-medium text-snack-text">Likes</p>
            <p className="text-xs text-snack-muted">Email me when someone likes my review</p>
          </div>
          <input
            type="checkbox"
            checked={preferences.emailOnLike}
            onChange={(e) =>
              setPreferences({ ...preferences, emailOnLike: e.target.checked })
            }
            className="h-5 w-5 rounded border-gray-300 text-snack-primary focus:ring-snack-primary"
          />
        </label>

        <label className="flex items-center justify-between gap-3 rounded-xl p-3 transition hover:bg-snack-surface cursor-pointer">
          <div>
            <p className="text-sm font-medium text-snack-text">Comments</p>
            <p className="text-xs text-snack-muted">Email me when someone comments on my review</p>
          </div>
          <input
            type="checkbox"
            checked={preferences.emailOnComment}
            onChange={(e) =>
              setPreferences({ ...preferences, emailOnComment: e.target.checked })
            }
            className="h-5 w-5 rounded border-gray-300 text-snack-primary focus:ring-snack-primary"
          />
        </label>

        <label className="flex items-center justify-between gap-3 rounded-xl p-3 transition hover:bg-snack-surface cursor-pointer">
          <div>
            <p className="text-sm font-medium text-snack-text">Mentions</p>
            <p className="text-xs text-snack-muted">Email me when someone mentions me in a post or comment</p>
          </div>
          <input
            type="checkbox"
            checked={preferences.emailOnMention}
            onChange={(e) =>
              setPreferences({ ...preferences, emailOnMention: e.target.checked })
            }
            className="h-5 w-5 rounded border-gray-300 text-snack-primary focus:ring-snack-primary"
          />
        </label>

        <label className="flex items-center justify-between gap-3 rounded-xl p-3 transition hover:bg-snack-surface cursor-pointer">
          <div>
            <p className="text-sm font-medium text-snack-text">Achievements</p>
            <p className="text-xs text-snack-muted">Email me when I unlock a new badge</p>
          </div>
          <input
            type="checkbox"
            checked={preferences.emailOnBadge}
            onChange={(e) =>
              setPreferences({ ...preferences, emailOnBadge: e.target.checked })
            }
            className="h-5 w-5 rounded border-gray-300 text-snack-primary focus:ring-snack-primary"
          />
        </label>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-snack-text">Push Notifications</h3>
        
        <label className="flex items-center justify-between p-3 rounded-xl hover:bg-snack-surface transition cursor-pointer">
          <div>
            <p className="text-sm font-medium text-snack-text">Likes</p>
            <p className="text-xs text-snack-muted">When someone likes your review</p>
          </div>
          <input
            type="checkbox"
            checked={preferences.pushOnLike}
            onChange={(e) =>
              setPreferences({ ...preferences, pushOnLike: e.target.checked })
            }
            className="h-5 w-5 rounded border-gray-300 text-snack-primary focus:ring-snack-primary"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-xl hover:bg-snack-surface transition cursor-pointer">
          <div>
            <p className="text-sm font-medium text-snack-text">Comments</p>
            <p className="text-xs text-snack-muted">When someone comments on your review</p>
          </div>
          <input
            type="checkbox"
            checked={preferences.pushOnComment}
            onChange={(e) =>
              setPreferences({ ...preferences, pushOnComment: e.target.checked })
            }
            className="h-5 w-5 rounded border-gray-300 text-snack-primary focus:ring-snack-primary"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-xl hover:bg-snack-surface transition cursor-pointer">
          <div>
            <p className="text-sm font-medium text-snack-text">Mentions</p>
            <p className="text-xs text-snack-muted">When someone mentions you in a review</p>
          </div>
          <input
            type="checkbox"
            checked={preferences.pushOnMention}
            onChange={(e) =>
              setPreferences({ ...preferences, pushOnMention: e.target.checked })
            }
            className="h-5 w-5 rounded border-gray-300 text-snack-primary focus:ring-snack-primary"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-xl hover:bg-snack-surface transition cursor-pointer">
          <div>
            <p className="text-sm font-medium text-snack-text">Achievements</p>
            <p className="text-xs text-snack-muted">When you unlock a new achievement</p>
          </div>
          <input
            type="checkbox"
            checked={preferences.pushOnBadge}
            onChange={(e) =>
              setPreferences({ ...preferences, pushOnBadge: e.target.checked })
            }
            className="h-5 w-5 rounded border-gray-300 text-snack-primary focus:ring-snack-primary"
          />
        </label>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-sm ${
            messageTone === 'success'
              ? 'bg-green-50 text-green-900'
              : 'bg-red-50 text-red-900'
          }`}
        >
          {message}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}
