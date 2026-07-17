/**
 * sw.js — Service worker do Dattaobra (PWA instalável + "casco" offline).
 *
 * Estratégia REDE PRIMEIRO no mesmo origem: quando ONLINE, sempre pega a versão
 * mais nova (nada de código velho — combina com o `_headers` no-cache) e guarda
 * uma cópia; OFFLINE, serve o que estiver em cache (o app abre e mostra o que já
 * carregou). A API do Apps Script e as fontes do Google (outro origem) passam
 * DIRETO pela rede — nunca são cacheadas (dados sempre atuais).
 */
// Versão do casco: SUBIR este número a cada deploy que precise "empurrar" o app
// novo. Bytes diferentes no sw.js → o navegador instala o SW novo, que assume na
// hora (skipWaiting + clients.claim) e limpa o cache antigo no activate. O
// clients.claim dispara `controllerchange` nas abas abertas → a página recarrega
// sozinha (ver o registro em index.html) e pega o código novo. Sem passo manual.
const CACHE = "dattaobra-shell-v49";
const ESSENCIAIS = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESSENCIAIS)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Só o MESMO ORIGEM (casco do app). Cross-origin (API do Apps Script, fontes)
  // segue o caminho normal do navegador — sempre rede, nunca cache.
  if (url.origin !== self.location.origin) return;

  // Navegar (abrir o app): rede primeiro; offline cai no index em cache.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // Demais assets do site: rede primeiro (atual quando online) + atualiza o cache;
  // offline, usa a cópia guardada.
  e.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.ok && resp.type === "basic") {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(req))
  );
});
