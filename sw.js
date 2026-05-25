const CACHE = 'lr-nails-v4';
const ASSETS = ['/', '/booking.html', '/admin.html', '/booking.js', '/booking-ui.js', '/admin-ui.js', '/booking.css', '/style.css'];

const ALLOWED_ORIGINS = [
  'https://ofekteremnailss.vercel.app',
  'https://script.google.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
];

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
  const origin = self.location.origin;
  const url = e.request.url;
  if (!ALLOWED_ORIGINS.concat(origin).some(o => url.startsWith(o))) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', e => {
  const data = e.data?.json() ?? { title: '💅 Ofek Terem Nails', body: 'תזכורת לתור שלך!' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo.png',
      badge: '/logo.png',
      vibrate: [200, 100, 200],
      data: { url: '/booking.html' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url ?? '/'));
});
