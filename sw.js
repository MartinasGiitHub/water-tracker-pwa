// Wasser Tracker - Service Worker
// Version 1.0 - Für Background-Benachrichtigungen und Offline-Support

const CACHE_NAME = 'wasser-tracker-v1';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Service Worker Installation
self.addEventListener('install', (event) => {
  console.log('💧 Service Worker: Installation gestartet');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('💧 Service Worker: Cache erstellt');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log('💧 Service Worker: Erfolgreich installiert');
        return self.skipWaiting();
      })
  );
});

// Service Worker Aktivierung
self.addEventListener('activate', (event) => {
  console.log('💧 Service Worker: Aktivierung gestartet');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('💧 Service Worker: Alte Cache entfernt:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('💧 Service Worker: Erfolgreich aktiviert');
      return self.clients.claim();
    })
  );
});

// Fetch Event - Offline-Support
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache-Hit: Gebe gecachte Version zurück
        if (response) {
          return response;
        }
        
        // Cache-Miss: Lade von Netzwerk
        return fetch(event.request);
      })
      .catch(() => {
        // Netzwerk nicht verfügbar - zeige Offline-Fallback
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// Background Sync für verpasste Benachrichtigungen
self.addEventListener('sync', (event) => {
  if (event.tag === 'water-reminder') {
    console.log('💧 Service Worker: Background Sync - Wasser-Erinnerung');
    event.waitUntil(sendWaterReminder());
  }
});

// Push Notifications empfangen
self.addEventListener('push', (event) => {
  console.log('💧 Service Worker: Push Nachricht empfangen');
  
  const options = {
    body: 'Zeit für ein Glas Wasser! 💧',
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='%232196F3'/><text x='50' y='60' text-anchor='middle' fill='white' font-size='40'>💧</text></svg>",
    badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><circle cx='48' cy='48' r='40' fill='%232196F3'/><text x='48' y='60' text-anchor='middle' fill='white' font-size='30'>💧</text></svg>",
    tag: 'water-reminder',
    renotify: true,
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    data: {
      url: '/',
      action: 'open-app'
    },
    actions: [
      {
        action: 'add-water',
        title: '250ml hinzufügen',
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><circle cx='48' cy='48' r='40' fill='%234CAF50'/><text x='48' y='60' text-anchor='middle' fill='white' font-size='30'>+</text></svg>"
      },
      {
        action: 'dismiss',
        title: 'Später erinnern',
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><circle cx='48' cy='48' r='40' fill='%23FF9800'/><text x='48' y='60' text-anchor='middle' fill='white' font-size='30'>⏰</text></svg>"
      }
    ]
  };

  if (event.data) {
    const data = event.data.json();
    options.body = data.body || options.body;
    options.data = { ...options.data, ...data };
  }

  event.waitUntil(
    self.registration.showNotification('💧 Wasser Tracker', options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('💧 Service Worker: Benachrichtigung angeklickt:', event.action);
  
  event.notification.close();

  if (event.action === 'add-water') {
    // Wasser hinzufügen via postMessage an alle offenen Tabs
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'ADD_WATER',
            amount: 250
          });
        });
        
        // Falls kein Tab offen ist, öffne die App
        if (clients.length === 0) {
          return self.clients.openWindow('/?action=add250');
        }
      })
    );
  } else if (event.action === 'dismiss') {
    // Später erinnern - registriere Background Sync
    event.waitUntil(
      self.registration.sync.register('water-reminder-delay')
    );
  } else {
    // Standard: App öffnen
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        // Bereits offener Tab? Fokussieren
        for (let client of clients) {
          if (client.url === self.location.origin + '/') {
            return client.focus();
          }
        }
        
        // Sonst neuen Tab öffnen
        return self.clients.openWindow('/');
      })
    );
  }
});

// Hilfsfunktionen für Benachrichtigungen
async function sendWaterReminder() {
  try {
    const permission = await self.registration.showNotification('💧 Zeit zu trinken!', {
      body: 'Du solltest jetzt ein Glas Wasser trinken. Dein Körper wird es dir danken!',
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='%232196F3'/><text x='50' y='60' text-anchor='middle' fill='white' font-size='40'>💧</text></svg>",
      tag: 'water-reminder',
      vibrate: [200, 100, 200],
      actions: [
        {
          action: 'add-water',
          title: '250ml hinzufügen'
        }
      ]
    });
    
    console.log('💧 Service Worker: Wasser-Erinnerung gesendet');
  } catch (error) {
    console.error('💧 Service Worker: Fehler bei Benachrichtigung:', error);
  }
}

// Periodische Background-Erinnerungen (experimentell)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'water-hourly-reminder') {
    console.log('💧 Service Worker: Stündliche Erinnerung');
    event.waitUntil(sendWaterReminder());
  }
});

// Message Handler für Kommunikation mit der App
self.addEventListener('message', (event) => {
  console.log('💧 Service Worker: Nachricht von App erhalten:', event.data);
  
  if (event.data.type === 'SCHEDULE_REMINDER') {
    // Plane nächste Erinnerung
    const delay = event.data.delay || 60 * 60 * 1000; // 1 Stunde Standard
    
    setTimeout(() => {
      sendWaterReminder();
    }, delay);
  }
  
  if (event.data.type === 'UPDATE_BADGE') {
    // Badge mit aktueller Wassermenge aktualisieren (falls unterstützt)
    if ('setAppBadge' in navigator) {
      const progress = Math.round((event.data.amount / 1800) * 100);
      navigator.setAppBadge(progress);
    }
  }
});

// Error Handler
self.addEventListener('error', (event) => {
  console.error('💧 Service Worker: Fehler aufgetreten:', event.error);
});

// Unhandled Promise Rejection Handler
self.addEventListener('unhandledrejection', (event) => {
  console.error('💧 Service Worker: Unbehandelte Promise-Ablehnung:', event.reason);
  event.preventDefault();
});

console.log('💧 Service Worker: Erfolgreich geladen und bereit!');