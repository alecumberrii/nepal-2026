/* Nepal 2026: funciona sin conexión. La app se sirve desde la caché y se actualiza en segundo plano.
   Las teselas del mapa que se han visto se guardan aparte (hasta MAXT) para poder verlas en el trek sin red. */
var CACHE = "nepal-2026-v6";
var TILES = "nepal-2026-teselas";
var MAXT = 3000;
var SHELL = ["./", "index.html", "manifest.webmanifest", "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return c.add(new Request(u, /^https:/.test(u) ? { mode: "cors" } : {})).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE && k !== TILES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
var puts = 0;
function trim() {
  return caches.open(TILES).then(function (c) {
    return c.keys().then(function (ks) {
      var extra = ks.length - MAXT;
      return extra > 0 ? Promise.all(ks.slice(0, extra).map(function (k) { return c.delete(k); })) : null;
    });
  });
}
self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  var same = url.origin === self.location.origin;
  var fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  var leaf = url.hostname === "unpkg.com" && url.pathname.indexOf("/leaflet@") === 0;
  var tile = /(^|\.)tile\.openstreetmap\.org$|(^|\.)tile\.opentopomap\.org$/.test(url.hostname) || (url.hostname === "server.arcgisonline.com" && url.pathname.indexOf("/tile/") > 0);
  if (tile) {
    /* teselas: primero la copia guardada; si no está, de la red y se guarda */
    e.respondWith(caches.open(TILES).then(function (c) {
      return c.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok) { c.put(req, res.clone()); if (++puts % 40 === 0) trim(); }
          return res;
        });
      });
    }));
    return;
  }
  if (!same && !fonts && !leaf) return; /* sincronización y tiempo: siempre a la red */
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: same }).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
