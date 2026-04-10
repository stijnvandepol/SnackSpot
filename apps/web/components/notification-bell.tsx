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

export function NotificationBell() {
  const { user, accessToken } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || !accessToken) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    const fetchNotifications = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/v1/me/notifications?limit=10', {
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
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
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

  if (!user) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-snack-text hover:text-snack-primary transition"
        aria-label="Notifications"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-snack-background rounded-xl shadow-xl border border-snack-border z-50 max-h-[600px] flex flex-col">
            <div className="p-4 border-b border-snack-border flex items-center justify-between">
              <h3 className="font-heading font-semibold text-snack-text">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs text-snack-primary hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1">
              {loading && notifications.length === 0 ? (
                <div className="p-8 text-center text-snack-muted text-sm">
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-snack-muted text-sm">
                  No notifications yet
                </div>
              ) : (
                <div className="divide-y divide-[#ececec]">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-snack-surface transition ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                    >
                      {notification.link ? (
                        <Link
                          href={notification.link}
                          onClick={() => {
                            markAsRead(notification.id)
                            setIsOpen(false)
                          }}
                          className="block"
                        >
                          <NotificationContent notification={notification} />
                        </Link>
                      ) : (
                        <div
                          onClick={() => markAsRead(notification.id)}
                          className="cursor-pointer"
                        >
                          <NotificationContent notification={notification} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-snack-border">
              <Link
                href="/profile?tab=notifications"
                onClick={() => setIsOpen(false)}
                className="text-sm text-snack-primary hover:underline text-center block"
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function NotificationContent({ notification }: { notification: Notification }) {
  return (
    <div className="flex gap-3">
      {notification.actor && (
        <AvatarLightbox
          avatarKey={notification.actor.avatarKey}
          username={notification.actor.username}
          size="sm"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-snack-text">
          {notification.title}
        </p>
        <p className="text-sm text-snack-muted line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-snack-muted mt-1">
          {timeAgo(notification.createdAt)}
        </p>
      </div>
      {!notification.isRead && (
        <div className="w-2 h-2 bg-snack-primary rounded-full mt-2 flex-shrink-0" />
      )}
    </div>
  )
}
