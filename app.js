document.addEventListener('DOMContentLoaded', () => {
  // --- CONFIGURATION ---
  // Bu URL'yi README dosyasındaki Adım 1'de oluşturduğunuz
  // kendi Cloudflare Worker adresinizle değiştirin.
  const API_PROXY_URL = 'https://red-base-2785.ercan-yagci.workers.dev/'; // <-- DEĞİŞTİRİLECEK

  const DEFAULT_LOCATION = { lat: 41.015137, lon: 28.979530 }; // İstanbul, Eminönü
  const RATING_WEIGHT = 0.4; // Puanlamanın ağırlığı (%40)
  const DISTANCE_WEIGHT = 0.6; // Mesafenin ağırlığı (%60)

  // --- UI ELEMENTS ---
  const mapElement = document.getElementById('map');
  const loaderElement = document.getElementById('loader');
  const notificationElement = document.getElementById('notification');
  const btnCoffee = document.getElementById('btn-coffee');
  const btnTea = document.getElementById('btn-tea');

  let map;
  let markers = [];
  let userMarker;

  // --- INITIALIZATION ---
  function initMap(location) {
    if (map) {
        map.setView([location.lat, location.lon], 15);
        return;
    }
    map = L.map(mapElement).setView([location.lat, location.lon], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
  }

  // --- UI HELPERS ---
  function showLoader(show) {
    loaderElement.classList.toggle('hidden', !show);
  }

  function showNotification(message, isError = false, duration = 3000) {
    notificationElement.textContent = message;
    notificationElement.className = 'notification show';
    if (isError) {
      notificationElement.classList.add('error');
    }
    setTimeout(() => {
      notificationElement.classList.remove('show');
    }, duration);
  }

  // --- CORE LOGIC ---
  
  /**
   * Kullanıcının coğrafi konumunu alır.
   * @returns {Promise<{lat: number, lon: number}>} Konum nesnesi
   */
  function getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        showNotification('Tarayıcınız konum servisini desteklemiyor.', true);
        return reject(new Error('Geolocation not supported.'));
      }

      const timer = setTimeout(() => {
        showNotification('Konum alınamadı, varsayılan konum kullanılıyor.');
        resolve(DEFAULT_LOCATION);
      }, 6000); // 6 saniye zaman aşımı

      navigator.geolocation.getCurrentPosition(
        position => {
          clearTimeout(timer);
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        error => {
          clearTimeout(timer);
          showNotification('Konum izni reddedildi, varsayılan konum kullanılıyor.', true);
          console.error(`Geolocation error: ${error.message}`);
          resolve(DEFAULT_LOCATION); // Hata durumunda varsayılan konuma dön
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  }

  /**
   * Foursquare'den mekanları proxy üzerinden arar.
   * @param {string} query - "tea" veya "coffee"
   * @param {{lat: number, lon: number}} location - Kullanıcının konumu
   * @returns {Promise<Array>} Mekanların listesi
   */
  async function searchPlaces(query, location) {
    showLoader(true);
    try {
      if (!API_PROXY_URL.includes('workers.dev')) {
         throw new Error("Lütfen app.js dosyasındaki API_PROXY_URL'yi kendi proxy adresinizle güncelleyin.");
      }
      const response = await fetch(API_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          lat: location.lat,
          lon: location.lon
        })
      });

      if (!response.ok) {
        throw new Error(`API hatası: ${response.statusText}`);
      }
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Mekanlar aranırken hata oluştu:', error);
      showNotification('Mekanlar alınamadı. Lütfen tekrar deneyin.', true);
      return [];
    } finally {
      showLoader(false);
    }
  }

  /**
   * Mekanları puana ve mesafeye göre sıralar.
   * @param {Array} places - Foursquare'den gelen mekan listesi
   * @returns {Array} Puanlanmış ve sıralanmış mekan listesi
   */
  function rankPlaces(places) {
    if (!places || places.length === 0) return [];

    const maxDistance = Math.max(...places.map(p => p.distance), 1);

    return places
      .map(place => {
        // Normalizasyon: Değerleri 0-1 arasına getirme
        const normalizedRating = (place.rating || 5) / 10; // Puan yoksa ortalama 5 ver
        const normalizedDistance = 1 - (place.distance / maxDistance);

        // Ağırlıklı puanlama
        const score = (normalizedRating * RATING_WEIGHT) + (normalizedDistance * DISTANCE_WEIGHT);
        
        return { ...place, score };
      })
      .sort((a, b) => b.score - a.score); // En yüksek puandan düşüğe sırala
  }

  /**
   * Haritadaki işaretçileri temizler ve yenilerini ekler.
   * @param {Array} places - Gösterilecek mekanların listesi
   * @param {{lat: number, lon: number}} userLocation - Kullanıcının konumu
   */
  function renderPlaces(places, userLocation) {
    // Önceki işaretçileri temizle
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    if (userMarker) map.removeLayer(userMarker);

    // Kullanıcı konumunu gösteren mavi daire
    userMarker = L.circle([userLocation.lat, userLocation.lon], {
        color: '#007bff',
        fillColor: '#007bff',
        fillOpacity: 0.3,
        radius: 50
    }).addTo(map).bindPopup('<b>Siz buradasınız</b>');
    
    if (places.length === 0) {
      showNotification('Yakınlarda uygun bir mekan bulunamadı.');
      map.setView([userLocation.lat, userLocation.lon], 15);
      return;
    }

    const latLngs = [[userLocation.lat, userLocation.lon]];

    places.slice(0, 10).forEach((place, index) => { // En iyi 10 mekanı göster
      const location = {
        lat: place.geocodes.main.latitude,
        lon: place.geocodes.main.longitude
      };
      latLngs.push([location.lat, location.lon]);
      
      const popupContent = `
        <div style="font-family: sans-serif; line-height: 1.4;">
          <strong style="font-size: 1.1em;">${index + 1}. ${place.name}</strong><br>
          ⭐ <b>Puan:</b> ${place.rating ? place.rating.toFixed(1) : 'N/A'} / 10<br>
          🚶 <b>Mesafe:</b> ${place.distance}m<br>
          <a href="https://www.google.com/maps?daddr=${location.lat},${location.lon}" target="_blank">Yol Tarifi Al</a>
        </div>
      `;

      const marker = L.marker([location.lat, location.lon]).addTo(map).bindPopup(popupContent);
      markers.push(marker);
    });

    // Haritayı tüm işaretçileri gösterecek şekilde ayarla
    map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50] });
  }

  // --- EVENT LISTENERS ---
  async function handleFind(query) {
    showLoader(true);
    try {
        const location = await getUserLocation();
        initMap(location);
        const places = await searchPlaces(query, location);
        const rankedPlaces = rankPlaces(places);
        renderPlaces(rankedPlaces, location);
    } catch(error) {
        console.error("İşlem sırasında bir hata oluştu:", error);
        showNotification("Beklenmedik bir hata oluştu.", true);
    } finally {
        showLoader(false);
    }
  }

  btnCoffee.addEventListener('click', () => handleFind('coffee'));
  btnTea.addEventListener('click', () => handleFind('tea'));

  // --- PWA Service Worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => console.log('ServiceWorker registered: ', registration))
        .catch(registrationError => console.log('ServiceWorker registration failed: ', registrationError));
    });
  }

  // --- INITIAL LOAD ---
  initMap(DEFAULT_LOCATION);
  showNotification('Çay mı, kahve mi? Seçimini yap!', false, 4000);
});
