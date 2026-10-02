// Service worker di Chi Comanda: mostra le notifiche dei nuovi ordini per i bartender.
// Non gestisce la cache: l'app funziona come prima, online.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
    let data = {}
    try {
        data = event.data ? event.data.json() : {}
    } catch {
        data = { title: 'Chi Comanda', body: event.data ? event.data.text() : '' }
    }
    event.waitUntil(self.registration.showNotification(data.title || 'Nuovo ordine', {
        body: data.body || '',
        tag: data.tag,
        // Un nuovo ordine deve far suonare/vibrare anche se ne è già visibile un altro
        renotify: !!data.tag,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        data: { url: data.url || '/' },
    }))
})

// Tocco sulla notifica: porta in primo piano l'app (se aperta) sulla pagina dell'ordine
self.addEventListener('notificationclick', event => {
    event.notification.close()
    const url = new URL(event.notification.data?.url || '/', self.location.origin).href
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        const client = windows.find(c => c.url.startsWith(self.location.origin))
        if (client) {
            await client.focus()
            if (client.url !== url && 'navigate' in client) await client.navigate(url)
            return
        }
        await self.clients.openWindow(url)
    })())
})
