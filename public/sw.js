// Service worker: mostra le notifiche push anche a scheda chiusa.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil((async () => {
    // Se la partita è già aperta e in primo piano, la notifica non serve.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = new URL(data.url || '/', self.location.origin);
    const focused = windows.some((w) => w.focused && new URL(w.url).searchParams.get('g') === target.searchParams.get('g'));
    if (focused) return;
    await self.registration.showNotification(data.title || 'Battaglia navale', {
      body: data.body || 'Tocca a te!',
      tag: data.tag || 'battaglia-navale',
      renotify: true,
      icon: '/icon.png',
      data: { url: target.href },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const g = new URL(url).searchParams.get('g');
    const existing = windows.find((w) => new URL(w.url).searchParams.get('g') === g);
    if (existing) return existing.focus();
    return self.clients.openWindow(url);
  })());
});
