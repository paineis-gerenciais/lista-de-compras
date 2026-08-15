/* Service worker v5. Assets agora têm hash no nome (o Vite gera), então o
   cache pode ser mais agressivo: um arquivo com hash nunca muda de conteúdo.
   Só o index.html precisa da estratégia "rede primeiro". */
const CACHE = 'lista-compras-v5';
const NEVER_CACHE = [
  'firestore.googleapis.com', 'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com', 'firebaseinstallations.googleapis.com'
];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // a Cache API só aceita GET
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (NEVER_CACHE.some((h) => url.hostname.includes(h))) return;
  if (url.origin !== self.location.origin) return;

  // navegação: rede primeiro, para não prender ninguém numa versão velha
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  // assets com hash: cache primeiro, sem revalidar
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone));
      }
      return res;
    }))
  );
});
