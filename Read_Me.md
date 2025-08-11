# **Çay mı, Kahve mi? v2.0 \- Kurulum ve Açıklamalar**

Bu proje, kullanıcının konumuna en yakın ve en yüksek puanlı çay veya kahve mekanlarını bulmak için Foursquare API'sini kullanan modern bir tek sayfalık web uygulamasıdır.

## **Proje Mimarisi**

* **Frontend:** HTML, CSS ve modern JavaScript (ES6+). Kullanıcı arayüzü için [Leaflet.js](https://leafletjs.com/) harita kütüphanesi kullanılmıştır.  
* **Hosting:** Statik dosyalar (index.html, style.css, app.js) **GitHub Pages** üzerinde ücretsiz olarak barındırılabilir.  
* **Backend (Proxy):** Foursquare API anahtarını güvende tutmak için **Cloudflare Workers** veya **Netlify Functions** gibi ücretsiz bir sunucusuz (serverless) fonksiyon kullanılır. **Bu adım güvenlik için zorunludur.**

## **Kurulum Adımları**

### **Adım 1: API Proxy Sunucusunu Oluşturma (Çok Önemli\!)**

API anahtarınızın çalınmasını önlemek için bu aracı sunucuyu kurmanız gerekir. Aşağıdaki seçeneklerden birini seçin (Cloudflare önerilir).

**Seçenek A: Cloudflare Workers (Önerilen)**

1. [Cloudflare](https://www.google.com/search?q=https://dash.cloudflare.com/sign-up) hesabı açın.  
2. Sol menüden "Workers & Pages" sekmesine gidin ve bir "Worker" oluşturun.  
3. İçindeki mevcut kodu silin ve aşağıdaki kodu yapıştırın.  
4. YOUR\_FOURSQUARE\_API\_KEY yazan yere kendi Foursquare API anahtarınızı girin.  
5. Worker'ı kaydedip dağıtın ("Save and Deploy"). Size https...workers.dev uzantılı bir URL verecektir. Bu URL'yi bir sonraki adımda kullanacaksınız.

// Cloudflare Worker Kodu (worker.js)  
addEventListener('fetch', event \=\> {  
  event.respondWith(handleRequest(event.request))  
})

async function handleRequest(request) {  
  // Sadece POST isteklerine izin ver  
  if (request.method \!== 'POST') {  
    return new Response('Sadece POST istekleri kabul edilir.', { status: 405 });  
  }

  // Güvenlik için API anahtarını buraya ekleyin  
  const FSQ\_API\_KEY \= 'YOUR\_FOURSQUARE\_API\_KEY'; // \<-- KENDİ API ANAHTARINIZI BURAYA GİRİN

  const { lat, lon, query } \= await request.json();  
  const searchParams \= new URLSearchParams({  
    query: query,  
    ll: \`${lat},${lon}\`,  
    radius: 2000, // 2 km yürüme mesafesi  
    categories: '13032,13035', // 13032: Coffee Shop, 13035: Tea Room  
    sort: 'DISTANCE',  
    limit: 20  
  });

  const fsq\_url \= \`https://api.foursquare.com/v3/places/search?${searchParams.toString()}\`;

  const fsqResponse \= await fetch(fsq\_url, {  
    headers: {  
      'Authorization': FSQ\_API\_KEY,  
      'Accept': 'application/json'  
    }  
  });

  const data \= await fsqResponse.json();

  // CORS başlıklarını ekleyerek yanıtı istemciye geri gönder  
  return new Response(JSON.stringify(data), {  
    headers: {  
      'Content-Type': 'application/json',  
      'Access-Control-Allow-Origin': '\*', // Güvenlik için burayı kendi domain'inizle değiştirebilirsiniz  
    },  
  });  
}

### **Adım 2: app.js Dosyasını Düzenleme**

Aşağıda verilen app.js dosyasını açın. API\_PROXY\_URL sabitini, 1\. Adım'da Cloudflare'den aldığınız Worker URL'si ile değiştirin.

// app.js içindeki bu satırı bulun ve değiştirin  
const API\_PROXY\_URL \= '\[https://senin-worker-adresin.workers.dev\](https://senin-worker-adresin.workers.dev)'; // \<-- 1\. ADIMDA ALDIĞINIZ URL

### **Adım 3: Dosyaları GitHub'a Yükleme**

1. Bu projedeki tüm dosyaları (index.html, style.css, app.js, sw.js, manifest.json) bir GitHub reposuna yükleyin.  
2. Repo ayarlarından "Pages" sekmesine gidin.  
3. "Source" olarak main (veya master) branch'inizi seçin ve kaydedin.  
4. GitHub size kullaniciadiniz.github.io/repo-adi/ şeklinde bir web sitesi adresi verecektir. Uygulamanız artık yayında\!