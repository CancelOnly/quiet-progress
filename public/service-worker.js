const CACHE_VERSION = 'quiet-progress-shell-v9-review-export';
const APP_SHELL_ASSETS = [
  '/manifest.json',
  '/styles.css',
  '/app.js',
  '/login.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/badge-72.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  /*
    Nunca cachear /api, /login nem navegações HTML protegidas.
    Isso evita vazar estado sensível e evita quebrar sessão/cookie.
  */
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/login') ||
    request.mode === 'navigate'
  ) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="background:#000;color:#f5f7fa;font-family:sans-serif;padding:24px"><h1>Quiet Progress offline</h1><p>Sem conexão com o servidor local. Volte quando o servidor estiver online.</p></body>',
            {
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store'
              }
            }
          )
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        const copy = response.clone();

        if (response.ok) {
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }

        return response;
      });
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: 'Quiet Progress',
      body: event.data ? event.data.text() : 'Novo lembrete.'
    };
  }

  const title = payload.title || 'Quiet Progress';
  const options = {
    body: payload.body || payload.message || 'Você tem um lembrete pendente.',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/badge-72.png',
    data: {
      route: payload.route || '/',
      type: payload.type || 'reminder',
      reminderId: payload.reminderId || null,
      sentAt: payload.sentAt || new Date().toISOString()
    },
    tag: payload.type ? `quiet-progress-${payload.type}` : 'quiet-progress',
    renotify: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const route = event.notification.data?.route || '/';
  const targetUrl = new URL(route, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
