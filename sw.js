// Hata Ayıklama Özellikli Cloudflare Worker Kodu

const ALLOWED_ORIGIN = 'https://eycg7.github.io';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }
  if (request.method === 'POST') {
    return handlePost(request);
  }
  return new Response('Beklenmeyen istek metodu.', { status: 405 });
}

async function handlePost(request) {
  const FSQ_API_KEY = 'YOUR_FOURSQUARE_API_KEY'; // <-- LÜTFEN KENDİ API ANAHTARINIZIN DOĞRU OLDUĞUNU TEKRAR KONTROL EDİN

  // --- HATA AYIKLAMA İÇİN TRY...CATCH BLOĞU EKLENDİ ---
  try {
    const { lat, lon, query } = await request.json();
    const searchParams = new URLSearchParams({
      query: query,
      ll: `${lat},${lon}`,
      radius: 3000,
      categories: '13032,13035',
      fields: 'fsq_id,name,geocodes,rating,distance,closed_bucket',
      sort: 'RELEVANCE',
      limit: 30
    });

    const fsq_url = `https://api.foursquare.com/v3/places/search?${searchParams.toString()}`;

    const fsqResponse = await fetch(fsq_url, {
      headers: {
        'Authorization': FSQ_API_KEY,
        'Accept': 'application/json'
      }
    });

    // Foursquare'den gelen yanıtı kontrol et
    if (!fsqResponse.ok) {
      // Eğer yanıt başarılı değilse (401, 403, 500 vb.), Foursquare'in hata mesajını al
      const errorData = await fsqResponse.json();
      const errorMessage = errorData.message || `Foursquare API Hatası: ${fsqResponse.status}`;
      // Bu hatayı uygulamaya geri gönder
      throw new Error(errorMessage);
    }

    const data = await fsqResponse.json();

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN
      },
    });

  } catch (error) {
    // Yakalanan hatayı anlamlı bir JSON formatında uygulamaya gönder
    return new Response(JSON.stringify({ error: true, message: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN
      },
    });
  }
}

function handleOptions(request) {
  const headers = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  return new Response(null, { headers });
}
