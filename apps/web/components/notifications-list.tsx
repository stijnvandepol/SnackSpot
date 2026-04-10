'use client'
import { useEffect, useState } from 'react'
import { useAuth } from './auth-provider'
import Link from 'next/link'
import { AvatarLightbox } from './avatar-lightbox'
import { timeAgo } from '@/lib/time'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
  actor: {
    id: string
    username: string
    avatarKey: string | null
  } | null
}

function NotificationsList() {
  const { user, accessToken } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user || !accessToken) {
      setLoading(false)
      setNotifications([])
      setUnreadCount(0)
      return
    }

    const fetchNotifications = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/v1/me/notifications?limit=50', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const json = await res.json()
        if (res.ok && json.data) {
          const nested = json.data as { data?: unknown; unreadCount?: unknown }
          const parsedNotifications = Array.isArray(nested.data)
            ? nested.data
            : Array.isArray(json.data)
              ? json.data
              : []
          const parsedUnreadCountRaw = nested.unreadCount ?? json.unreadCount
          const parsedUnreadCount = typeof parsedUnreadCountRaw === 'number' ? parsedUnreadCountRaw : 0

          setNotifications(parsedNotifications as Notification[])
          setUnreadCount(parsedUnreadCount)
        } else {
          setNotifications([])
          setUnreadCount(0)
        }
      } catch {
        setNotifications([])
        setUnreadCount(0)
      } finally {
        setLoading(false)
      }
    }

    fetchNotifications()
  }, [user, accessToken])

  const markAsRead = async (notificationId: string) => {
    if (!accessToken) return

    try {
      await fetch(`/api/v1/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // handled silently
    }
  }

  const markAllAsRead = async () => {
    if (!accessToken) return

    try {
      await fetch('/api/v1/notifications/read-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {
      // handled silently
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card h-16 animate-pulse bg-snack-surface" />
        ))}
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-snack-muted text-sm">No notifications yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-snack-muted">{unreadCount} unread</span>
          <button
            onClick={markAllAsRead}
            className="text-xs text-snack-primary hover:underline"
          >
            Mark all as read
          </button>
        </div>
      )}

      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`card p-3 transition ${!notification.isRead ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' : ''}`}
        >
          {notification.link ? (
            <Link
              href={notification.link}
              onClick={() => markAsRead(notification.id)}
              className="block"
            >
              <NotificationRow notification={notification} />
            </Link>
          ) : (
            <div onClick={() => markAsRead(notification.id)} className="cursor-pointer">
              <NotificationRow notification={notification} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default NotificationsList

function NotificationRow({ notification }: { notification: Notification }) {
  return (
    <div className="flex gap-2">
      {notification.actor && (
        <AvatarLightbox
          avatarKey={notification.actor.avatarKey}
          username={notification.actor.username}
          size="sm"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-snack-text leading-tight">
          {notification.title}
        </p>
        <p className="text-xs text-snack-muted line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-snack-muted mt-1">
          {timeAgo(notification.createdAt)}
        </p>
      </div>
      {!notification.isRead && (
        <div className="w-2 h-2 bg-snack-primary rounded-full mt-1 flex-shrink-0" />
      )}
    </div>
  )
}
