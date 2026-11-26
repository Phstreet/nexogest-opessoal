import { expect, test } from "@playwright/test";

const email = process.env.NEXO_DEV_TEST_USER_A_EMAIL;
const password = process.env.NEXO_DEV_TEST_USER_A_PASSWORD;
const baseUrl = "http://127.0.0.1:3001";

test("Auth SSR real: login, refresh de cookie e logout no NEXO-DEV", async ({ page, context }) => {
  test.skip(!email || !password, "Credenciais de teste DEV são provisionadas pelo job RLS.");

  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email!);
  await page.getByLabel("Senha").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(baseUrl + "/");

  const beforeResponse = await page.request.get(baseUrl + "/api/auth");
  expect(beforeResponse.ok()).toBeTruthy();
  const before = await beforeResponse.json();
  expect(before.session?.user?.id).toBeTruthy();
  const userId = before.session.user.id;

  await context.addCookies([{
    name: "nexo_token_expires_at",
    value: "1",
    url: baseUrl,
    httpOnly: true,
    sameSite: "Lax",
  }]);
  await page.reload();
  await expect(page).toHaveURL(baseUrl + "/");

  await expect.poll(async () => {
    const response = await page.request.get(baseUrl + "/api/auth");
    if (!response.ok()) return 0;
    const body = await response.json();
    return Number(body.session?.expires_at ?? 0);
  }).toBeGreaterThan(Math.floor(Date.now() / 1000) + 60);

  const refreshedResponse = await page.request.get(baseUrl + "/api/auth");
  const refreshed = await refreshedResponse.json();
  expect(refreshed.session?.user?.id).toBe(userId);

  const cookies = await context.cookies(baseUrl);
  const expiry = Number(cookies.find((cookie) => cookie.name === "nexo_token_expires_at")?.value ?? 0);
  expect(expiry).toBeGreaterThan(Math.floor(Date.now() / 1000) + 60);

  await page.getByRole("button", { name: "Abrir menu da conta" }).click();
  await page.getByRole("menuitem", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(/\/entrar$/);

  const afterLogout = await page.request.get(baseUrl + "/api/auth");
  expect(afterLogout.ok()).toBeTruthy();
  expect((await afterLogout.json()).session).toBeNull();
});
