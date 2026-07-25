/**
 * Servis iscisi — oyunun telefona kurulup INTERNETSIZ calismasini saglar.
 *
 * Strateji: once ag, olmazsa onbellek (network-first, cache fallback).
 * Boylece guncelleme aldiginda hep en yeni surumu gorursun; internet yoksa
 * son oynadigin surum onbellekten acilir.
 *
 * Vite uretimde dosya adlarina hash ekledigi icin (index-a1b2c3.js) elle
 * dosya listesi tutmak kirilgan olurdu; bunun yerine indirilen her sey
 * calisma aninda onbellege alinir.
 */
const CACHE = 'alev-damla-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();                       // yeni surum hemen devralsin
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Yalnizca kendi kaynagimiz onbellege alinir (uzak istekler dokunulmadan gecer)
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
