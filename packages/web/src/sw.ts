/// <reference lib="webworker" />

// NOTE: keep the Workbox injection point so vite-plugin-pwa can build.
// We intentionally do not use Workbox runtime helpers here: iOS Safari can be
// fragile with more complex SW bundles. For push notifications we only need a
// minimal SW.

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision?: string }>;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const __precacheManifest = self.__WB_MANIFEST;

type PushPayload = {
  title?: string;
  body?: string;
  tag?: string;
  data?: {
    url?: string;
    sessionId?: string;
    type?: string;
  };
  icon?: string;
  badge?: string;
};

const STATIC_CACHE_NAME = 'oc-static-v1';
const FONT_CACHE_NAME = 'oc-fonts-v1';

// Assets to cache for offline/fast load
const FONT_URL_PATTERNS = [
  /JetBrainsMono/i,
  /FiraCode/i,
  /IBMPlexMono/i,
  /IBMPlexSans/i,
];

const isStaticAsset = (url: string): boolean => {
  const u = new URL(url);
  return (
    u.pathname.endsWith('.js') ||
    u.pathname.endsWith('.css') ||
    u.pathname.endsWith('.woff2') ||
    u.pathname.endsWith('.woff') ||
    u.pathname.endsWith('.png') ||
    u.pathname.endsWith('.svg') ||
    u.pathname.endsWith('.ico') ||
    u.pathname.endsWith('.webmanifest')
  );
};

const isFontRequest = (url: string): boolean =>
  FONT_URL_PATTERNS.some((p) => p.test(url));

const isAPIRequest = (url: string): boolean => {
  const u = new URL(url);
  return u.pathname.startsWith('/api/') || u.pathname.startsWith('/v1/');
};

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old caches on activation
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE_NAME && k !== FONT_CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      ),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET, cross-origin, and API requests
  if (request.method !== 'GET' || isAPIRequest(url)) {
    return;
  }

  // Fonts: CacheFirst — they never change once loaded
  if (isFontRequest(url)) {
    event.respondWith(
      caches.open(FONT_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  // Static assets (JS/CSS/images): StaleWhileRevalidate — serve fast, update in background
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        });
        return cached ?? networkFetch;
      }),
    );
    return;
  }
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const payload = (event.data?.json() ?? null) as PushPayload | null;
    if (!payload) {
      return;
    }

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const hasVisibleClient = clients.some((client) => client.visibilityState === 'visible' || client.focused);
    if (hasVisibleClient) {
      return;
    }

    const title = payload.title || 'OpenChamber';
    const body = payload.body ?? '';
    const icon = payload.icon ?? '/apple-touch-icon-180x180.png';
    const badge = payload.badge ?? '/favicon-32.png';

    await self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag: payload.tag,
      data: payload.data,
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = (event.notification.data ?? null) as { url?: string } | null;
  const url = data?.url ?? '/';

  event.waitUntil(self.clients.openWindow(url));
});
