const CACHE_NAME = 'crea-kitty-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png'
  // No incluyas aquí los scripts de Firebase o Tailwind, ya que se sirven desde sus CDNs.
];

// Instalación del Service Worker y cacheo de archivos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercepta las peticiones y sirve desde el caché si es posible
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si la respuesta está en el caché, la devuelve. Si no, la busca en la red.
        return response || fetch(event.request);
      })
  );
});