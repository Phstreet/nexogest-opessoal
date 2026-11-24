import { expect, test } from "@playwright/test";

test("manifest PWA é acessível e declara os metadados essenciais", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/manifest+json");
  const manifest = await response.json();

  expect(manifest.id).toBe("/");
  expect(manifest.name).toBe("NEXO");
  expect(manifest.short_name).toBe("NEXO");
  expect(manifest.lang).toBe("pt-BR");
  expect(manifest.display).toBe("standalone");
  expect(manifest.orientation).toBe("portrait");
  expect(manifest.scope).toBe("/");
  expect(manifest.start_url).toContain("source=pwa");
  expect(manifest.shortcuts).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "Central do Dia" }),
    expect.objectContaining({ name: "Contas a pagar" }),
    expect.objectContaining({ name: "Agenda" }),
    expect.objectContaining({ name: "Hábitos" }),
  ]));
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192", purpose: "any" }),
    expect.objectContaining({ sizes: "512x512", purpose: "any" }),
    expect.objectContaining({ sizes: "192x192", purpose: "maskable" }),
    expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
  ]));
});

test("ícones PWA e splash do iPhone são servidos", async ({ request }) => {
  for (const path of [
    "/icons/nexo-192.png",
    "/icons/nexo-512.png",
    "/icons/nexo-maskable-192.png",
    "/icons/nexo-maskable-512.png",
    "/icons/apple-touch-icon.png",
    "/icons/apple-splash-1170x2532.png",
    "/icons/apple-splash-1179x2556.png",
    "/favicon.svg",
  ]) {
    const response = await request.get(path);
    expect(response.ok(), path).toBeTruthy();
  }
});

test("service worker declara somente cache público e fallback offline estático", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["cache-control"]).toContain("no-store");
  const worker = await response.text();

  expect(worker).toContain('request.mode === "navigate"');
  expect(worker).toContain('url.pathname.startsWith("/api/")');
  expect(worker).toContain('url.pathname.startsWith("/_next/")');
  expect(worker).toContain('url.searchParams.has("_rsc")');
  expect(worker).toContain('event.data?.type === "SKIP_WAITING"');
  expect(worker).toContain('event.data?.type === "CLEAR_USER_DATA"');
  expect(worker).toContain('OFFLINE_SHELL = "/offline-shell.html"');
  expect(worker).not.toContain('cache.add(new Request("/offline"');
});

test("fallback offline estático não contém dados pessoais nem scripts", async ({ request }) => {
  const response = await request.get("/offline-shell.html");
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain("Você está sem conexão.");
  expect(html).toContain("Conteúdo privado protegido");
  expect(html).not.toContain("<script");
  expect(html).not.toContain("R$");
});

test("página offline pública renderiza sem autenticação", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "Você está sem conexão." })).toBeVisible();
  await expect(page.getByText(/não são armazenados para uso offline/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Tentar novamente" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("o service worker é registrado em produção", async ({ page }) => {
  test.skip(process.env.NODE_ENV !== "production", "Execute esta validação com npm run build e npm start.");
  await page.goto("/offline");
  await expect.poll(async () => page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    return Boolean(await navigator.serviceWorker.getRegistration("/"));
  }), { timeout: 15000 }).toBe(true);
});

test("o registro do service worker fica desativado em desenvolvimento", async ({ page }) => {
  test.skip(process.env.NODE_ENV === "production", "Em produção, o worker é registrado para teste no preview HTTPS.");
  await page.goto("/offline");
  const registration = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return "unsupported";
    return (await navigator.serviceWorker.getRegistration()) ? "registered" : "not-registered";
  });
  expect(registration).not.toBe("registered");
});
