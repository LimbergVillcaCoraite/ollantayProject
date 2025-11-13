const CACHE_NAME = 'ollantay-v1.0.0'
const STATIC_ASSETS = ['/', '/index.html']

// Install: cache static shell
self.addEventListener('install', evt => {
  console.log('[SW] Installing...')
  evt.waitUntil(
    caches.open(CACHE_NAME).then(c => {
      console.log('[SW] Caching static assets')
      return c.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', evt => {
  console.log('[SW] Activating...')
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  )
  return self.clients.claim()
})

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url)
  if (url.pathname.startsWith('/api/')) {
    evt.respondWith(fetch(evt.request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })))
    return
  }
  evt.respondWith(
    caches.match(evt.request).then(resp => resp || fetch(evt.request).then(r => {
      if (!r || r.status !== 200 || r.type !== 'basic') return r
      const clone = r.clone()
      caches.open(CACHE_NAME).then(cache => cache.put(evt.request, clone))
      return r
    }).catch(() => new Response('<h1>Offline</h1><p>Sin conexión</p>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })))
  )
})

// Push notification handler
self.addEventListener('push', evt => {
  console.log('[SW] Push received:', evt)
  let data = { title: 'Ollantay', body: 'Nueva notificación', icon: '/favicon.ico' }
  if (evt.data) {
    try { data = evt.data.json() } catch (e) { data.body = evt.data.text() }
  }
  const options = {
    body: data.body || data.mensaje || 'Tienes una nueva notificación',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'ollantay-notification',
    data: data.data || {},
    requireInteraction: data.prioridad === 'alta',
    vibrate: data.prioridad === 'alta' ? [200, 100, 200] : [100],
  }
  evt.waitUntil(self.registration.showNotification(data.title || data.titulo || 'Ollantay', options))
})

// Notification click handler
self.addEventListener('notificationclick', evt => {
  console.log('[SW] Notification clicked:', evt.notification.tag)
  evt.notification.close()
  const urlToOpen = evt.notification.data?.url || '/'
  evt.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url === urlToOpen && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen)
    })
  )
})

// Background sync
self.addEventListener('sync', evt => {
  console.log('[SW] Background sync:', evt.tag)
  if (evt.tag === 'sync-pending-actions') {
    evt.waitUntil(syncPendingActions())
  }
})

async function syncPendingActions() {
  console.log('[SW] Syncing pending actions...')
  return Promise.resolve()
}
