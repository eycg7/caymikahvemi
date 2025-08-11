// Önbelleğe alınacak dosyaların listesi
const CACHE_NAME = 'caykahve-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js', // HATA DÜZELTİLDİ: Doğru dosya adı kullanılıyor.
  '/manifest.json',
  '/icons/icon-192x192.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Yükleme (install) olayı: Önbelleği oluştur ve dosyaları ekle
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Etkinleştirme (activate) olayı: Eski önbellekleri temizle
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Getirme (fetch) olayı: İstekleri önbellekten sun, yoksa ağdan getir
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Önbellekte varsa, önbellekten yanıt ver
        if (response) {
          return response;
        }
        // Önbellekte yoksa, ağdan getirmeyi dene
        return fetch(event.request);
      }
    )
  );
});
