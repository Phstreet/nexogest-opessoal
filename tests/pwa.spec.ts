import { expect, test } from "@playwright/test";

test("manifest PWA é acessível e declara os metadados essenciais", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.name).toBe("NEXO");
  expect(manifest.short_name).toBe("NEXO");
  expect(manifest.display).toBe("standalone");
  expect(manifest.scope).toBe("/");
  expect(manifest.start_url).toContain("source=pwa");
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192", purpose: "any" }),
    expect.objectContaining({ sizes: "512x512", purpose: "any" }),
    expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
  ]));
});

test("service worker é servido com sucesso e sem cache de dados", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBeTruthy();
  const worker = await response.text();
  expect(worker).toContain("request.mode === \"navigate\"");
  expect(worker).toContain("/api/");
  expect(worker).toContain("SKIP_WAITING");
  expect(worker).not.toContain("cache.put(request, response.clone())");
});

test("página offline é pública e renderiza sem autenticação", async ({ page }) => {
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "Você está sem conexão." })).toBeVisible();
  await expect(page.getByText(/não são armazenados para uso offline/i)).toBeVisible();
});
