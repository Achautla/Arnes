// Funcionamiento sin conexión: guarda la app y el motor 3D la primera vez que se abren
const CACHE = "arnes-v12";
const CORE = ["./", "index.html", "styles.css", "manifest.webmanifest", "icon.svg",
  "src/main.js", "src/util.js", "src/mannequin.js", "src/poses.js", "src/props.js", "src/lights.js", "src/render.js", "src/store.js", "src/example.js",
  "src/props2.js", "src/scenes.js", "src/scenarios.js", "src/page.js", "src/home.js", "src/cloud.js", "src/cloud-config.js", "src/cloth.js", "src/share.js", "src/accessories.js", "src/contact.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const external = /jsdelivr|cdnjs|fonts\.(googleapis|gstatic)/.test(url.host);
  if (url.origin !== location.origin && !external) return;
  e.respondWith(
    fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});
