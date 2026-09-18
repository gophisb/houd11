const CACHE_NAME = "ar-rafeeq-v3.1.2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./variables.css",
  "./config.js",
  "./prayer.js",
  "./locations.js",
  "./router.js",
  "./app.js",
  "./js/location-manager.js",
  "./js/prayer-times.js",
  "./js/page-modules.js",
  "./pages/home.html",
  "./pages/quran.html",
  "./pages/azkar.html",
  "./pages/prayer.html",
  "./pages/tafsir.html",
  "./pages/qibla.html",
  "./pages/nawawi.html",
  "./pages/settings.html",
  "./assets/icons/icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(APP_SHELL).catch(error => {
        console.warn("الرفيق: تعذر تخزين بعض موارد shell", error);
      })
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith("ar-rafeeq-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
  );
});