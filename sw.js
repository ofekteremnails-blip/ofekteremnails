const CACHE = 'lr-nails-v4';
const ASSETS = ['/', '/booking.html', '/admin.html', '/booking.js', '/booking-ui.js', '/admin-ui.js', '/booking.css', '/style.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', e => {
  const data = e.data?.json() ?? { title: '💅 Lian Rebekah Nails', body: 'תזכורת לתור שלך!' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/Screenshot 2026-03-27 122808.png',
      badge: '/Screenshot 2026-03-27 122808.png',
      vibrate: [200, 100, 200],
      data: { url: '/booking.html' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url ?? '/'));
});
