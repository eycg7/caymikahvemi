// Daha Sağlam Service Worker Kodu (v3)

const CACHE_NAME = 'caykahve-cache-v3'; // Sürümü artırarak eski önbelleği geçersiz kılıyoruz
const REPO_NAME = '/caymikahvemi';

const urlsToCache = [
  REPO_NAME + '/',
  REPO_NAME + '/index.html',
  REPO_NAME + '/style.css',
  REPO_NAME + '/app.js',
  REPO_NAME + '/manifest.json',
  REPO_NAME + '/icons/icon-192x192.png',
  REPO_NAME + '/icons/icon-512x512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Yükleme (install) olayı: Önbelleği oluştur ve dosyaları tek tek ekle
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('Opened cache. Caching files one by one...');
      
      // 'addAll' yerine, dosyaları tek tek önbelleğe alıyoruz.
      // Bu sayede biri başarısız olursa diğerleri etkilenmez.
      for (const url of urlsToCache) {
        try {
          await cache.add(url);
        } catch (error) {
          console.warn(`Failed to cache ${url}:`, error);
        }
      }
    })()
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
        return response || fetch(event.request);
      })
  );
});