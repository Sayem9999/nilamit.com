 
/**
 * Firebase Messaging service worker.
 *
 * Receives push payloads when the tab is closed/backgrounded and shows
 * them as native browser notifications.
 *
 * Loaded by browser at /firebase-messaging-sw.js (must be at site root for
 * scope to cover the whole app). Registered from src/lib/fcm.ts on user
 * opt-in.
 *
 * NOTE: service workers run in a Worker context — no `window`, no module
 * imports beyond importScripts. We use the compat SDK here because the
 * modular SDK requires bundler support that service workers don't have.
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Same projectId / messagingSenderId / appId / apiKey as the main app.
// These are public values (visible in the JS bundle anyway). Hard-coding
// is fine here because service workers can't read process.env.
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
