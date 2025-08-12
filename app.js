document.addEventListener('DOMContentLoaded', () => {
  // --- CONFIGURATION ---
  const API_PROXY_URL = 'https://red-base-2785.ercan-yagci.workers.dev/';
  const DEFAULT_LOCATION = { lat: 39.925533, lon: 32.866287 }; // Ankara, Kızılay

  // --- UI ELEMENTS (Yeni Tasarıma Göre Güncellendi) ---
  const mapElement = document.getElementById('map');
  const loaderElement = document.getElementById('loader');
  const notificationElement = document.getElementById('notification');
  const findBtn = document.getElementById('findBtn');
  const radiusSlider = document.getElementById('radius');

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

  function showNotification(message, isError = false, duration = 6000) {
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
              errorMessage = 'Konum izni reddedildi. Lütfen tarayıcı ayarlarından bu site için konuma izin verin.';
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

  async function searchPlaces(location, radius) {
    showLoader(true);
    try {
      const response = await fetch(API_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: location.lat,
          lon: location.lon,
          radius: radius
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
      showNotification('Bu mesafede uygun bir kafe bulunamadı.');
      map.setView([userLocation.lat, userLocation.lon], 14);
      return;
    }

    const latLngs = [[userLocation.lat, userLocation.lon]];

    const uniquePlaces = [];
    const placeIds = new Set();

    places.forEach(place => {
      if (!placeIds.has(place.id)) {
        uniquePlaces.push(place);
        placeIds.add(place.id);
      }
    });

    uniquePlaces.slice(0, 30).forEach((place) => {
      const location = {
        lat: place.lat || place.center.lat,
        lon: place.lon || place.center.lon
      };
      latLngs.push([location.lat, location.lon]);
      
      const name = place.tags && place.tags.name ? place.tags.name : 'İsimsiz Kafe';

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
  async function handleFind() {
    showLoader(true);
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
      
      if (permissionStatus.state === 'denied') {
        throw new Error('Konum izni reddedilmiş. Lütfen tarayıcı ayarlarından izin verin.');
      }
      
      const location = await getUserLocation();
      initMap(location);

      const radius = radiusSlider.value; // Slider'dan değeri doğrudan al
      const places = await searchPlaces(location, radius);
      renderPlaces(places, location);

    } catch(error) {
        showNotification(error.message, true);
        initMap(DEFAULT_LOCATION);
    } finally {
        showLoader(false);
    }
  }
  
  // Slider ilerleme çubuğunu güncelleyen kod
  const updateProgress = () => {
    const min = parseFloat(radiusSlider.min), max = parseFloat(radiusSlider.max), val = parseFloat(radiusSlider.value);
    const pct = ((val - min) / (max - min)) * 100;
    radiusSlider.style.setProperty('--progress', pct + '%');
  };
  radiusSlider.addEventListener('input', updateProgress);
  updateProgress(); // Sayfa ilk yüklendiğinde de çalıştır

  findBtn.addEventListener('click', handleFind);

  // --- PWA Service Worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/caymikahvemi/sw.js')
        .then(registration => console.log('ServiceWorker registered: ', registration))
        .catch(registrationError => console.log('ServiceWorker registration failed: ', registrationError));
    });
  }

  // --- INITIAL LOAD ---
  // Haritayı başlangıçta göstermeyip, arama sonrası görünür kılabiliriz.
  // initMap(DEFAULT_LOCATION); 
  // showNotification('Yakınındaki kafeleri bulmak için butona dokun.', false, 4000);
});
