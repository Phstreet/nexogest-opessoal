import { expect, test } from "@playwright/test";

test.describe("NEXO PWA", () => {
  test("expõe manifesto válido com os atalhos principais", async ({ page }) => {
    const response = await page.request.get("/manifest.webmanifest");
    expect(response.ok()).toBeTruthy();
    const manifest = await response.json();
    expect(manifest.name).toBe("NEXO");
    expect(manifest.short_name).toBe("NEXO");
    expect(manifest.display).toBe("standalone");
    expect(manifest.scope).toBe("/");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ sizes: "192x192", purpose: "maskable" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" })
    ]));
    expect(manifest.shortcuts).toHaveLength(4);
  });

  test("página offline está disponível sem autenticação", async ({ page }) => {
    const response = await page.request.get("/offline");
    expect(response.status()).toBe(200);
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();
  });

  test("registra o service worker em preview/produção", async ({ page, context }) => {
    test.skip(process.env.PLAYWRIGHT_PWA_PRODUCTION !== "true", "O service worker fica desativado em desenvolvimento.");
    await page.goto("/");
    await expect.poll(async () => context.serviceWorkers().length).toBeGreaterThan(0);
    expect(context.serviceWorkers().some((worker) => worker.url().endsWith("/sw.js"))).toBeTruthy();
  });
});
