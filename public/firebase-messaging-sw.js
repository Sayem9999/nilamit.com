 
/**
 * Firebase Messaging service worker + lightweight PWA cache layer.
 *
 * Two responsibilities, one file because browsers register one SW per
 * scope and Firebase Messaging hard-codes /firebase-messaging-sw.js
 * as its path.
 *
 *   1. FCM background push (Firebase Messaging compat SDK).
 *   2. App-shell caching for offline browsing of /auctions + /.
 *
 * Strategy:
 *   - Navigation → network-first, fall back to cached shell on offline.
 *     Lets logged-in users see "yesterday's homepage" if their wifi cuts
 *     out mid-bid.
 *   - Static assets (_next/static/*, /icon-*) → cache-first with
 *     stale-while-revalidate. Huge win on repeat visits over 3G.
 *   - API + RTDB + Auth → network-only. We never want to serve cached
 *     auction data — staleness here means showing wrong current price.
 *   - Cache version bumped manually below; on activate, old caches are
 *     deleted so a deploy invalidates the offline shell within ~24h.
 *
 * If this file changes after a deploy, browsers may take up to 24h to
 * pick up the new SW (Service Worker auto-update is conservative).
 * Workaround for urgent changes: bump CACHE_VERSION below + redeploy.
 */

const CACHE_VERSION = 'v3-2026-05-28';
const SHELL_CACHE = `nilamit-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `nilamit-static-${CACHE_VERSION}`;

// Routes pre-cached on install so the very first offline visit works.
// Keep small — every entry forces a network fetch on SW install.
const SHELL_URLS = ['/', '/auctions', '/manifest.json', '/icon-192.png', '/icon-512.png'];

// ────────────────────────────────────────────────────────────────────
// Firebase Messaging
// ────────────────────────────────────────────────────────────────────

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAOwypGtSAeCsZpHogZx7Jt_MPX2nh3GZM',
  authDomain: 'nilamit-52073.firebaseapp.com',
  projectId: 'nilamit-52073',
  storageBucket: 'nilamit-52073.firebasestorage.app',
  messagingSenderId: '884637735592',
  appId: '1:884637735592:web:b817a744a54f15a663409d',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Nilamit';
  const body = (payload.notification && payload.notification.body) || '';
  const click = (payload.data && payload.data.click_action) || '/';

  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-32.png',
    data: { click },
    tag: (payload.data && payload.data.tag) || 'nilamit',
    requireInteraction: false,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.click) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.endsWith(target) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    }),
  );
});

// ────────────────────────────────────────────────────────────────────
// Install — pre-cache shell URLs
// ────────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        // addAll is atomic — if any URL fails the whole install fails. Use
        // individual put() in try/catch so a single 404 doesn't brick the SW.
        Promise.all(
          SHELL_URLS.map((url) =>
            fetch(url, { credentials: 'same-origin' })
              .then((res) => (res.ok ? cache.put(url, res.clone()) : null))
              .catch(() => null),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

// ────────────────────────────────────────────────────────────────────
// Activate — purge old caches
// ────────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('nilamit-') && k !== SHELL_CACHE && k !== STATIC_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ────────────────────────────────────────────────────────────────────
// Fetch — strategy router
// ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache same-origin API or auth — we'd serve stale auction prices.
  if (url.origin === self.location.origin && (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/data/')
  )) {
    return; // browser handles it network-only
  }

  // Static assets — cache-first, revalidate in background.
  if (
    url.origin === self.location.origin && (
      url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/icon-') ||
      url.pathname === '/manifest.json' ||
      url.pathname === '/robots.txt' ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.woff2')
    )
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation (HTML page loads) — network-first with offline shell fallback.
  if (request.mode === 'navigate' || request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(networkFirstThenShell(request));
    return;
  }

  // Everything else — just go to network.
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    // Revalidate in the background so the cache stays fresh without
    // blocking the response.
    fetch(request)
      .then((res) => {
        if (res.ok) cache.put(request, res.clone());
      })
      .catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    // Network failed and no cache — let the browser show its offline UI.
    throw err;
  }
}

async function networkFirstThenShell(request) {
  try {
    const res = await fetch(request);
    // Cache successful HTML responses so repeat navigations are instant.
    if (res.ok && res.headers.get('content-type')?.includes('text/html')) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    // Offline — try the cached version of this exact URL first.
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fall back to the cached homepage / auctions shell so the user
    // sees something rather than the browser's offline error.
    const shell =
      (await caches.match('/auctions')) || (await caches.match('/'));
    if (shell) return shell;
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
