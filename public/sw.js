/* NEXO PWA — cache restrito a arquivos estáticos públicos. */
const CACHE_PREFIX = "nexo-static-";
const CACHE_NAME = "nexo-static-v1";
const OFFLINE_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#101012">
<title>NEXO — Sem conexão</title>
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#101012;color:#eef0f4;font-family:Inter,system-ui,-apple-system,sans-serif}
main{min-height:100dvh;display:grid;place-items:center;padding:32px 22px calc(32px + env(safe-area-inset-bottom))}
section{width:min(100%,420px);padding:30px;border:1px solid #303038;border-radius:22px;background:#19191e;text-align:center}
.mark{width:58px;height:58px;margin:0 auto 24px;display:grid;place-items:center;border-radius:17px;background:#e5e7eb;color:#111;font-size:34px;font-weight:800}
h1{margin:0 0 10px;font-size:25px}p{margin:0;color:#aeb3bd;line-height:1.65;font-size:14px}
small{display:block;margin-top:24px;color:#858b96;font-size:11px}
</style>
</head>
<body><main><section><div class="mark" aria-hidden="true">N</div><h1>Você está sem conexão</h1><p>Por segurança, o NEXO não mantém informações financeiras ou pessoais disponíveis offline. Conecte-se à internet e tente novamente.</p><small>Seus dados continuam protegidos na sua conta.</small></section></main></body>
</html>`;

self.addEventListener("install", () => {
  // Não chama skipWaiting automaticamente: a atualização depende da escolha do usuário.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "PURGE_USER_DATA") {
    event.waitUntil((async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("nexo-user-")).map((name) => caches.delete(name)));
    })());
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca intercepta endpoints, RSC, Server Actions ou navegação autenticada.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.searchParams.has("_rsc") ||
    request.headers.has("next-action") ||
    request.headers.get("RSC") === "1"
  ) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(() => new Response(OFFLINE_HTML, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
    })));
    return;
  }

  const isPublicStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/nexo-icon.svg" ||
    url.pathname === "/favicon.ico";

  if (!isPublicStatic) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
