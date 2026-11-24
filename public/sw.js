/* NEXO PWA v3 — apenas recursos públicos. HTML autenticado e dados privados nunca entram no cache. */
"use strict";

const CACHE_PREFIX = "nexo-public-";
const CACHE_NAME = "nexo-public-v3";
const OFFLINE_SHELL = "/offline-shell.html";
const STATIC_PATHS = [
  OFFLINE_SHELL,
  "/offline.css",
  "/icons/nexo-192.png",
  "/icons/nexo-512.png",
  "/icons/nexo-maskable-192.png",
  "/icons/nexo-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_PATHS))
  );
  // A nova versão aguarda a decisão explícita do usuário.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "CLEAR_USER_DATA") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key))
      ))
    );
  }
});

function isPrivateOrUncacheable(response) {
  const cacheControl = response.headers.get("Cache-Control") || "";
  return response.headers.has("Set-Cookie") ||
    /private|no-store|no-cache/i.test(cacheControl);
}

function isFrameworkDataRequest(request, url) {
  return url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/storage/") ||
    url.searchParams.has("_rsc") ||
    request.headers.has("RSC") ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.has("Next-Action");
}

function isPublicStaticRequest(url) {
  return url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/offline.css" ||
    url.pathname === OFFLINE_SHELL;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isFrameworkDataRequest(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const fallback = await cache.match(OFFLINE_SHELL);
        return fallback || new Response("Você está sem conexão. Seus dados continuam protegidos.", {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      })
    );
    return;
  }

  if (!isPublicStaticRequest(url)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok && response.type === "basic" && !isPrivateOrUncacheable(response)) {
        await cache.put(request, response.clone());
      }
      return response;
    })
  );
});
