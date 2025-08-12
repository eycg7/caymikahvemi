document.addEventListener('DOMContentLoaded', () => {
  // --- CONFIGURATION ---
  const API_PROXY_URL = 'https://red-base-2785.ercan-yagci.workers.dev/';
  const DEFAULT_LOCATION = { lat: 39.925533, lon: 32.866287 }; // Ankara, Kızılay
  // YENİ: Slider için mesafe adımları (metre cinsinden)
  const DISTANCE_STEPS = [200, 500, 1000, 2000, 5000];

  // --- UI ELEMENTS (Yeni Tasarıma Göre Güncellendi) ---
  const mapElement = document.getElementById('map');
  const loaderElement = document.getElementById('loader');
  const notificationElement = document.getElementById('notification');
  const findBtn = document.getElementById('findBtn');
  const radiusSlider = document.getElementById('radius');
  const ticksContainer = document.querySelector('.ticks');

  let map;
  let markers = [];
  let userMarker;
  let searchRadiusCircle; // YENİ: Arama dairesini tutmak için değişken

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
  
  function renderPlaces(places, userLocation, radius) {
    // Önceki işaretçileri ve daireyi temizle
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    if (userMarker) map.removeLayer(userMarker);
    if (searchRadiusCircle) map.removeLayer(searchRadiusCircle);

    // Kullanıcı konumunu göster
    userMarker = L.circle([userLocation.lat, userLocation.lon], {
        color: '#007bff',
        fillColor: '#007bff',
        fillOpacity: 0.3,
        radius: 50
    }).addTo(map).bindPopup('<b>Siz buradasınız</b>');
    
    // YENİ: Arama yarıçapını gösteren daireyi çiz
    searchRadiusCircle = L.circle([userLocation.lat, userLocation.lon], {
        radius: radius,
        color: '#b46a37',
        fillColor: '#b46a37',
        fillOpacity: 0.1,
        weight: 1
    }).addTo(map);

    if (places.length === 0) {
      showNotification('Bu mesafede uygun bir kafe bulunamadı.');
      // Haritayı arama alanına sığdır
      map.fitBounds(searchRadiusCircle.getBounds());
      return;
    }

    const latLngs = [];

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

    // Haritayı arama alanına sığdır
    map.fitBounds(searchRadiusCircle.getBounds(), { padding: [20, 20] });
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

      // Slider'ın index değerinden gerçek mesafeyi al
      const radius = DISTANCE_STEPS[radiusSlider.value];
      const places = await searchPlaces(location, radius);
      renderPlaces(places, location, radius);

    } catch(error) {
        showNotification(error.message, true);
        initMap(DEFAULT_LOCATION);
    } finally {
        showLoader(false);
    }
  }
  
  // Slider ilerleme çubuğunu ve aktif etiketi güncelleyen kod
  const updateSliderUI = () => {
    const value = parseInt(radiusSlider.value);
    const min = parseInt(radiusSlider.min);
    const max = parseInt(radiusSlider.max);
    
    // Yüzdeyi hesapla
    const pct = ((value - min) / (max - min)) * 100;
    radiusSlider.style.setProperty('--progress', pct + '%');

    // Etiketleri vurgula
    const ticks = ticksContainer.querySelectorAll('span');
    ticks.forEach((span, index) => {
      span.style.fontWeight = index === value ? 'bold' : 'normal';
      span.style.color = index === value ? '#3a2e2a' : '#6b5b53';
    });
  };
  radiusSlider.addEventListener('input', updateSliderUI);
  updateSliderUI(); // Sayfa ilk yüklendiğinde de çalıştır

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
  // Haritayı başlangıçta gösterme
});
