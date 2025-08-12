document.addEventListener('DOMContentLoaded', () => {
  // --- CONFIGURATION ---
  const API_PROXY_URL = 'https://red-base-2785.ercan-yagci.workers.dev/';
  const DEFAULT_LOCATION = { lat: 39.925533, lon: 32.866287 }; // Ankara, Kızılay

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
      map.setView([location.lat, location.lon], 14);
      return;
    }
    map = L.map(mapElement, { zoomControl: false }).setView([location.lat, location.lon], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
  }

  // --- UI HELPERS ---
  function showLoader(show) {
    loaderElement.classList.toggle('hidden', !show);
  }

  function showNotification(message, isError = false, duration = 5000) {
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
  function getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Tarayıcınız konum servisini desteklemiyor.'));
      }
      navigator.geolocation.getCurrentPosition(
        position => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        error => {
          let errorMessage = 'Konum alınamadı.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Konum izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Konum bilgisi mevcut değil.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Konum alma işlemi zaman aşımına uğradı.';
              break;
          }
          reject(new Error(errorMessage));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  async function searchPlaces(query, location) {
    showLoader(true);
    try {
      const response = await fetch(API_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query, // 'cafe' veya 'tea_room' olarak gönderilecek
          lat: location.lat,
          lon: location.lon
        })
      });
      
      const data = await response.json();
      console.log('Overpass API Yanıtı:', data);

      if (data.error) {
        throw new Error(data.message);
      }
      
      return data.elements || [];

    } catch (error) {
      console.error('Mekanlar aranırken hata oluştu:', error);
      showNotification(`Hata: ${error.message}`, true);
      return [];
    } finally {
      showLoader(false);
    }
  }
  
  // OSM'den gelen veriyi haritada göstermek için fonksiyon
  function renderPlaces(places, userLocation) {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    if (userMarker) map.removeLayer(userMarker);

    userMarker = L.circle([userLocation.lat, userLocation.lon], {
        color: '#007bff',
        fillColor: '#007bff',
        fillOpacity: 0.3,
        radius: 50
    }).addTo(map).bindPopup('<b>Siz buradasınız</b>');
    
    if (places.length === 0) {
      showNotification('Yakınlarda uygun bir mekan bulunamadı.');
      map.setView([userLocation.lat, userLocation.lon], 14);
      return;
    }

    const latLngs = [[userLocation.lat, userLocation.lon]];

    places.slice(0, 20).forEach((place, index) => { // En yakın 20 mekanı göster
      // OSM verisi Foursquare'den farklıdır, konumu doğru yerden almalıyız.
      const location = {
        lat: place.lat || place.center.lat,
        lon: place.lon || place.center.lon
      };
      latLngs.push([location.lat, location.lon]);
      
      const name = place.tags && place.tags.name ? place.tags.name : 'İsimsiz Mekan';

      const popupContent = `
        <div style="font-family: sans-serif; line-height: 1.5;">
          <strong style="font-size: 1.1em;">${name}</strong><br>
          <a href="https://www.google.com/maps?daddr=${location.lat},${location.lon}" target="_blank">Yol Tarifi Al</a>
        </div>
      `;
      const marker = L.marker([location.lat, location.lon]).addTo(map).bindPopup(popupContent);
      markers.push(marker);
    });

    map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50] });
  }

  // --- EVENT LISTENERS ---
  async function handleFind(query) {
    showLoader(true);
    try {
        const location = await getUserLocation();
        initMap(location);
        // OSM'in anladığı etiketleri gönderiyoruz: 'cafe' veya 'tea_room'
        const osmQuery = query === 'coffee' ? 'cafe' : 'tea_room';
        const places = await searchPlaces(osmQuery, location);
        renderPlaces(places, location);
    } catch(error) {
        showNotification(error.message, true);
        initMap(DEFAULT_LOCATION);
    } finally {
        showLoader(false);
    }
  }

  btnCoffee.addEventListener('click', () => handleFind('coffee'));
  btnTea.addEventListener('click', () => handleFind('tea'));

  // --- PWA Service Worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/caymikahvemi/sw.js')
        .then(registration => console.log('ServiceWorker registered: ', registration))
        .catch(registrationError => console.log('ServiceWorker registration failed: ', registrationError));
    });
  }

  // --- INITIAL LOAD ---
  initMap(DEFAULT_LOCATION);
  showNotification('Çay mı, kahve mi? Konumunuzu bulmak için birine dokunun.', false, 4000);
});
