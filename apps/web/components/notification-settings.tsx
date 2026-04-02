'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'

interface NotificationPreferences {
  emailOnLike: boolean
  emailOnComment: boolean
  emailOnMention: boolean
  emailOnBadge: boolean
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

  useEffect(() => {
    if (!accessToken) return

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

  if (loading) {
    return (
      <div className={embedded ? 'rounded-xl border border-snack-border bg-snack-background p-4' : 'card p-4'}>
        <p className="text-sm text-snack-muted">Loading settings...</p>
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className={embedded ? 'rounded-xl border border-snack-border bg-snack-background p-4' : 'card p-4'}>
        <p className="text-sm text-snack-muted">Could not load notification settings</p>
      </div>
    )
  }

  return (
    <div className={`${embedded ? 'rounded-xl border border-snack-border bg-snack-background p-4' : 'card p-6'} space-y-6`}>
      <div>
        {!embedded && (
          <h2 className="mb-2 text-lg font-heading font-semibold text-snack-text">
            Notification Settings
          </h2>
        )}
        <p className="text-sm text-snack-muted">
          Choose which alerts SnackSpot sends you by email.
        </p>
      </div>

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
            className="h-5 w-5 rounded border-snack-border text-snack-primary focus:ring-snack-primary"
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
            className="h-5 w-5 rounded border-snack-border text-snack-primary focus:ring-snack-primary"
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
            className="h-5 w-5 rounded border-snack-border text-snack-primary focus:ring-snack-primary"
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
            className="h-5 w-5 rounded border-snack-border text-snack-primary focus:ring-snack-primary"
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
