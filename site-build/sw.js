// Cache version for updating
const CACHE_NAME = 'nis-website-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  // Add university logos for caching
  'https://norwegianinternationalschools.com/wp-content/uploads/2024/06/stanford-1024x449-1.png',
  'https://norwegianinternationalschools.com/wp-content/uploads/2024/06/oxford.png',
  'https://norwegianinternationalschools.com/wp-content/uploads/2024/06/ohio.png',
  'https://norwegianinternationalschools.com/wp-content/uploads/2024/06/mit-1024x672-1.jpg',
  'https://norwegianinternationalschools.com/wp-content/uploads/2024/06/havard.png',
  'https://norwegianinternationalschools.com/wp-content/uploads/2024/06/UniversityOfCambridgeLogo-1.png',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('norwegianinternationalschools.com') &&
      !event.request.url.includes('res.cloudinary.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          // Add to cache for images and other assets
          if (event.request.destination === 'image' || 
              event.request.url.includes('.css') || 
              event.request.url.includes('.js')) {
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
          }
          
          return response;
        }).catch(() => {
          // Return offline fallback if available
          if (event.request.destination === 'document') {
            return caches.match('/');
          }
        });
      })
  );
});
