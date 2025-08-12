document.addEventListener('DOMContentLoaded', () => {
  // --- UYARI: BU BİR TEST SÜRÜMÜDÜR ---
  // API anahtarı bu dosyada herkese görünür durumdadır.
  // Bu sürüm sadece sorunun kaynağını teşhis etmek içindir.
  const FSQ_API_KEY = 'YOUR_FOURSQUARE_API_KEY'; // <-- LÜTFEN YENİ VE AKTİF ANAHTARINIZI BURAYA GİRİN

  const DEFAULT_LOCATION = { lat: 39.925533, lon: 32.866287 }; // Ankara, Kızılay
  const RATING_WEIGHT = 0.4;
  const DISTANCE_WEIGHT = 0.6;

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

  // --- DEĞİŞTİRİLDİ: Foursquare'e doğrudan istek atılıyor ---
  async function searchPlaces(query, location) {
    showLoader(true);
    
    const searchParams = new URLSearchParams({
        query: query,
        ll: `${location.lat},${location.lon}`,
        radius: 3000,
        categories: '13032,13035',
        fields: 'fsq_id,name,geocodes,rating,distance,closed_bucket',
        sort: 'RELEVANCE',
        limit: 30
    });

    const fsq_url = `https://api.foursquare.com/v3/places/search?${searchParams.toString()}`;

    try {
      const response = await fetch(fsq_url, {
        method: 'GET', // Metod GET olarak değiştirildi
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': FSQ_API_KEY // Anahtar doğrudan başlığa eklendi
        }
      });
      
      const data = await response.json();
      console.log('Doğrudan Foursquare Yanıtı:', data);

      if (!response.ok || data.message) {
        throw new Error(data.message || 'Bilinmeyen Foursquare hatası');
      }
      
      return data.results || [];

    } catch (error) {
      console.error('Mekanlar aranırken hata oluştu:', error);
      showNotification(`Hata: ${error.message}`, true);
      return [];
    } finally {
      showLoader(false);
    }
  }

  function rankPlaces(places) {
    if (!places || places.length === 0) return [];
    const maxDistance = Math.max(...places.map(p => p.distance), 1);
    return places
      .map(place => {
        const normalizedRating = (place.rating || 5) / 10;
        const normalizedDistance = 1 - (place.distance / maxDistance);
        const score = (normalizedRating * RATING_WEIGHT) + (normalizedDistance * DISTANCE_WEIGHT);
        return { ...place, score };
      })
      .sort((a, b) => b.score - a.score);
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
      showNotification('Yakınlarda uygun bir mekan bulunamadı.');
      map.setView([userLocation.lat, userLocation.lon], 14);
      return;
    }

    const latLngs = [[userLocation.lat, userLocation.lon]];

    places.slice(0, 10).forEach((place, index) => {
      const location = {
        lat: place.geocodes.main.latitude,
        lon: place.geocodes.main.longitude
      };
      latLngs.push([location.lat, location.lon]);
      
      let statusHtml = '';
      if (place.closed_bucket === 'LIKELY_CLOSED' || place.closed_bucket === 'VERY_LIKELY_CLOSED') {
        statusHtml = '🔴 <b>Durum:</b> Muhtemelen Kapalı';
      } else {
        statusHtml = '🟢 <b>Durum:</b> Açık';
      }

      const popupContent = `
        <div style="font-family: sans-serif; line-height: 1.5;">
          <strong style="font-size: 1.1em;">${index + 1}. ${place.name}</strong><br>
          ${statusHtml}<br>
          ⭐ <b>Puan:</b> ${place.rating ? place.rating.toFixed(1) : 'N/A'} / 10<br>
          🚶 <b>Mesafe:</b> ${place.distance}m<br>
          <a href="https://www.google.com/maps?daddr=${location.lat},${location.lon}" target="_blank">Yol Tarifi Al</a>
        </div>
      `;
      const marker = L.marker([location.lat, location.lon]).addTo(map).bindPopup(popupContent);
      markers.push(marker);
    });

    map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50] });
  }

  async function handleFind(query) {
    showLoader(true);
    try {
      const location = await getUserLocation();
      initMap(location);
      const places = await searchPlaces(query, location);
      if (places.length > 0) {
        const rankedPlaces = rankPlaces(places);
        renderPlaces(rankedPlaces, location);
      }
    } catch(error) {
      showNotification(error.message, true);
      initMap(DEFAULT_LOCATION);
    } finally {
      showLoader(false);
    }
  }

  btnCoffee.addEventListener('click', () => handleFind('coffee'));
  btnTea.addEventListener('click', () => handleFind('tea'));

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/caymikahvemi/sw.js')
        .then(registration => console.log('ServiceWorker registered: ', registration))
        .catch(registrationError => console.log('ServiceWorker registration failed: ', registrationError));
    });
  }

  initMap(DEFAULT_LOCATION);
  showNotification('Çay mı, kahve mi? Konumunuzu bulmak için birine dokunun.', false, 4000);
});
