// Service Worker for Budget Tracker
// Enables background push notifications and offline support

// Auto-generated cache version based on build timestamp
const BUILD_TIMESTAMP = '2025-12-12T18:45:12Z'; // Auto-updated on deployment
const CACHE_VERSION = BUILD_TIMESTAMP.replace(/[-:]/g, '').replace(/T/g, '-').replace(/Z/g, '');
const CACHE_NAME = `budget-tracker-${CACHE_VERSION}`;

console.log(`🔧 Service Worker Cache: ${CACHE_NAME}`);

const urlsToCache = [
  './',
  './index.html',
  './script.js',
  './style.css',
  './manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Service Worker: Cache failed', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
// IMPORTANT: Don't cache external API calls (Supabase, etc.)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip caching for:
  // 1. External APIs (Supabase, etc.)
  // 2. Chrome extensions
  // 3. Non-HTTP(S) requests
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('airtable.com') ||
    url.protocol === 'chrome-extension:' ||
    (!url.protocol.startsWith('http'))
  ) {
    // Don't intercept - let it pass through
    return;
  }

  // Only cache our own app files
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // Fallback for offline
        console.log('Service Worker: Fetch failed, offline');
      })
  );
});

// Push event - handle background push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received', event);
  
  let notificationData = {
    title: '💰 Budget Tracker',
    body: 'New expense added',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'expense-notification',
    requireInteraction: false,
    data: {
      url: '/'
    }
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data
      };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data
    })
  );
});

// Notification click event - open/focus the app when notification is clicked
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);

  event.notification.close();

  // Get the URL to open (default to home page)
  const urlToOpen = event.notification.data?.url || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUnassigned: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            // Focus existing window
            return client.focus();
          }
        }
        // Open new window if app is not open
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync event (for offline expense submission)
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'sync-expenses') {
    event.waitUntil(
      // Sync pending expenses when back online
      syncPendingExpenses()
    );
  }
});

async function syncPendingExpenses() {
  // This would sync any expenses saved while offline
  console.log('Service Worker: Syncing pending expenses');
  // Implementation would depend on your offline storage strategy
}
