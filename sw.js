/*
  Service Worker — Lista de Compras (Fase 3)

  Estratégia: stale-while-revalidate para os assets do app. Serve do cache
  na hora (abre rápido e funciona offline no corredor do mercado) e busca a
  versão nova em segundo plano para a próxima abertura.

  Dados nunca passam pelo cache: Firestore e Auth vão sempre para a rede,
  e o próprio SDK do Firestore cuida do offline via IndexedDB (A5).

  IMPORTANTE — v2 → v3: subir CACHE_NAME é o que força os aparelhos que já
  instalaram o PWA a baixarem a versão nova. Sem isso, quem instalou na
  Fase 2 continuaria vendo o app antigo indefinidamente.
*/

const CACHE_NAME = 'lista-compras-v6';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Domínios cuja resposta jamais deve ser cacheada.
const NEVER_CACHE = [
  'firestore.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'identitytoolkit.googleapis.com',   // Firebase Auth
  'securetoken.googleapis.com',       // renovação de token
  'googleapis.com',
  'firebaseio.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll falha inteiro se um arquivo faltar; individualmente é tolerante
      Promise.all(ASSETS_TO_CACHE.map((url) =>
        cache.add(url).catch((e) => console.warn('[sw] não cacheou', url, e))
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // A Cache API só aceita requisições GET. Qualquer outro método vai direto
  // para a rede. Isso cobre os canais de streaming do Firestore, que usam
  // POST internamente — a causa do TypeError corrigido na Fase 2.
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Só administramos requisições da própria origem; CDNs e APIs seguem soltas.
  if (NEVER_CACHE.some((h) => url.hostname.includes(h))) return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Permite que a página peça a ativação imediata de uma versão nova.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
