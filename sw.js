const CACHE_NAME = 'jade-v6.2';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './jade-texture.png',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = event.request.url;
    if (url.includes('firebaseio.com') || url.includes('googleapis.com') || url.includes('gstatic.com') || url.includes('google.com')) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// ═══════ PUSH NOTIFICATIONS ═══════

self.addEventListener('push', event => {
    let data = { title: 'Jade', body: 'You are here now' };
    
    if (event.data) {
        try {
            const payload = event.data.json();
            if (payload.notification) {
                data = payload.notification;
            }
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        vibrate: [100, 50, 100],
        data: data.data || {},
        actions: []
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Open app when notification is tapped
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // If app is already open, focus it
            for (const client of clientList) {
                if (client.url.includes('jade') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open it
            return clients.openWindow('./');
        })
    );
});
