/*
  Service Worker - Lista de Compras
  Estratégia: cache-first para os assets do app (offline-first da interface).
  A sincronização de dados (Apps Script) sempre vai para a rede, nunca para o cache,
  já que dados precisam estar sempre atualizados quando há conexão.
*/

const CACHE_NAME = 'lista-compras-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // A Cache API só aceita respostas de requisições GET. Qualquer outro
  // método (POST, PUT, etc.) vai direto para a rede, sem passar pelo cache.
  // Isso cobre, entre outros, os canais de streaming do Firestore (que usam
  // POST internamente) e qualquer chamada futura que não seja leitura.
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Nunca cachear chamadas ao Firestore/Firebase (dados precisam ser sempre frescos)
  if (url.hostname.includes('firestore.googleapis.com') || url.hostname.includes('googleapis.com') || url.hostname.includes('firebaseio.com')) {
    event.respondWith(fetch(event.request).catch(() => new Response(
      JSON.stringify({ ok: false, offline: true }),
      { headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  // Assets do próprio app: cache-first com atualização em segundo plano
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
