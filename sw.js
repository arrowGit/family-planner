const CACHE_NAME = 'planner-v1';

// що кешуємо (тільки UI!)
const STATIC_ASSETS = [
  '/family-planner/',
  '/family-planner/index.html',
  '/family-planner/manifest.json'
];

// install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// activate (чистка старих кешів)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

// fetch
self.addEventListener('fetch', event => {

  const url = new URL(event.request.url);

  // ❗ НЕ кешуємо Supabase
  if (url.hostname.includes('supabase.co')) {
    return; // network only
  }

  // UI → cache-first
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        return cached || fetch(event.request);
      })
  );
});
