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

export function NotificationSettings() {
  const { accessToken } = useAuth()
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
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
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage(json.error ?? 'Failed to save settings')
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
        setTimeout(() => setMessage(null), 5000)
      }
    } catch (error) {
      console.error('Failed to request push permission', error)
    }
  }

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-snack-muted">Loading settings...</p>
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className="card p-4">
        <p className="text-sm text-snack-muted">Could not load notification settings</p>
      </div>
    )
  }

  return (
    <div className="card p-6 space-y-6">
      <div>
        <h2 className="font-heading font-semibold text-lg text-snack-text mb-2">
          Notification Settings
        </h2>
        <p className="text-sm text-snack-muted">
          Choose when you want to receive notifications
        </p>
      </div>

      {pushSupported && pushPermission !== 'granted' && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-900 mb-2">
            📱 Enable push notifications to receive real-time alerts
          </p>
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
          <p className="text-sm text-green-900">
            ✅ Push notifications are enabled
          </p>
        </div>
      )}

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
            <p className="text-sm font-medium text-snack-text">Badges</p>
            <p className="text-xs text-snack-muted">When you earn a new badge</p>
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
            message.includes('success')
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
