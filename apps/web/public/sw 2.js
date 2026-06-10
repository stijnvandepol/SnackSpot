// SnackSpot service worker — Web Push delivery + notification clicks.
// Registered on demand when the user enables push notifications.

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'SnackSpot', message: event.data.text() }
  }

  const title = payload.title || 'SnackSpot'
  const options = {
    body: payload.message || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-128.png',
    data: { url: payload.url || '/' },
    tag: payload.tag || undefined,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus an existing tab when one is open, otherwise open a new one.
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    }),
  )
})
