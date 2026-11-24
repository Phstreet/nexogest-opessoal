/* NEXO PWA — cache exclusivamente público e estático. Nunca armazena páginas ou dados autenticados. */
"use strict";

const CACHE_PREFIX = "nexo-public-";
const CACHE_NAME = "nexo-public-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.add(new Request(OFFLINE_URL, { cache: "reload" }))
    )
  );
  // Sem skipWaiting automático: a atualização só é ativada após escolha do usuário.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "CLEAR_USER_DATA") {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys
          .filter((key) => key.startsWith(CACHE_PREFIX))
          .map((key) => caches.delete(key))))
        .then(() => caches.open(CACHE_NAME))
        .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
    );
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // APIs, Server Actions, RSC e qualquer rota de dados ficam sempre fora do cache.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") && !url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/storage/")
  ) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(OFFLINE_URL)) ||
          new Response("Você está sem conexão. Conecte-se para acessar seus dados com segurança.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
          });
      })
    );
    return;
  }

  const isPublicStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.svg";

  if (!isPublicStatic) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    })
  );
});
