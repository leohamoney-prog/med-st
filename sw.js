const CACHE = 'medst-v1';
const FIREBASE_URLS = [
  'https://www.gstatic.com/firebasejs/'
];

// Файлы для кэша при установке
const PRECACHE = [
  '/',
  '/index.html'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase запросы — только сеть (данные должны быть свежими)
  if (url.includes('firestore.googleapis.com') || url.includes('firebase')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(
        JSON.stringify({error: 'offline'}),
        {headers: {'Content-Type': 'application/json'}}
      ))
    );
    return;
  }

  // gstatic Firebase SDK — кэш с обновлением
  if (FIREBASE_URLS.some(u => url.startsWith(u))) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(r => {
          caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          return r;
        });
        return cached || fresh;
      })
    );
    return;
  }

  // Всё остальное — кэш сначала, потом сеть
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r.ok) {
          caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        }
        return r;
      }).catch(() => {
        // Офлайн fallback — возвращаем index.html
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
