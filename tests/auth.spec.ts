import { test, expect, type Page } from "@playwright/test";

const testSession = {
  user: { id: "user-nexo-e2e", email: "teste@nexo.local", user_metadata: { display_name: "Teste NEXO" } },
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

type AuthResponse = {
  status?: number;
  body: Record<string, unknown>;
};

async function mockAuthApi(
  page: Page,
  handler: (action: string, payload: Record<string, unknown>) => AuthResponse | Promise<AuthResponse>
) {
  let currentSession: typeof testSession | null = null;

  await page.route("**/api/auth", async (route) => {
    const request = route.request();

    if (request.method() === "GET") {
      await route.fulfill({ json: { session: currentSession } });
      return;
    }

    const payload = request.postDataJSON() as Record<string, unknown>;
    const result = await handler(String(payload.action || ""), payload);
    if ((result.status || 200) < 400 && result.body.session) {
      currentSession = result.body.session as typeof testSession;
    }
    await route.fulfill({
      status: result.status || 200,
      contentType: "application/json",
      body: JSON.stringify(result.body),
    });
  });

  await page.route("**/api/sync**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { data: [] } });
      return;
    }

    await route.fulfill({
      json: {
        result: {
          saved: true,
          current_revision: 1,
          current_updated_at: new Date().toISOString(),
        },
      },
    });
  });
}

test.describe("NEXO - Autenticação e recuperação de acesso", () => {
  test("mantém o cadastro público fechado na interface", async ({ page }) => {
    await page.goto("/cadastro");
    await expect(page.getByRole("heading", { name: "Cadastro temporariamente fechado" })).toBeVisible();
    await expect(page.getByText(/concluindo as validações de segurança/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Já possui uma conta\? Entrar/i })).toBeVisible();
    await expect(page.locator("form")).toHaveCount(0);
  });

  test("bloqueia cadastro direto na API quando a chave de abertura não está ativa", async ({ request }) => {
    const response = await request.post("/api/auth", {
      headers: { Origin: "http://127.0.0.1:3001" },
      data: { action: "signup", email: "novo@nexo.local", password: "SenhaSegura123", displayName: "Novo usuário" },
    });
    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("cadastro público do NEXO está temporariamente fechado"),
    });
  });

  test("deve autenticar o usuário e encaminhá-lo para a página inicial", async ({ page }) => {
    await mockAuthApi(page, async (action, payload) => {
      expect(action).toBe("login");
      expect(payload.email).toBe("teste@nexo.local");
      expect(payload.password).toBe("SenhaSegura123");
      return { body: { session: testSession } };
    });

    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill("teste@nexo.local");
    await page.getByLabel("Senha").fill("SenhaSegura123");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL("http://127.0.0.1:3001/");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("deve solicitar recuperação de senha sem revelar se o e-mail existe", async ({ page }) => {
    await mockAuthApi(page, async (action, payload) => {
      expect(action).toBe("recovery");
      expect(payload.email).toBe("conta@nexo.local");
      return { body: { ok: true } };
    });

    await page.goto("/recuperar-senha");
    await page.getByLabel("E-mail").fill("conta@nexo.local");
    await page.getByRole("button", { name: "Enviar link de recuperação" }).click();

    await expect(page.getByRole("status")).toContainText("Se o endereço estiver cadastrado");
  });

  test("deve validar a sessão de recuperação antes de permitir alterar a senha", async ({ page }) => {
    await mockAuthApi(page, async (action, payload) => {
      if (action === "recovery-session") {
        expect(payload.access_token).toBe("token-acesso-teste");
        expect(payload.refresh_token).toBe("token-renovacao-teste");
        return { body: { session: testSession } };
      }

      if (action === "change-password") {
        expect(payload.password).toBe("NovaSenhaSegura123");
        return { body: { ok: true } };
      }

      throw new Error("Ação inesperada na recuperação: " + action);
    });

    await page.goto("/redefinir-senha#access_token=token-acesso-teste&refresh_token=token-renovacao-teste&expires_in=3600");

    await expect(page.getByRole("heading", { name: "Nova senha" })).toBeVisible();
    await page.locator('input[type="password"]').nth(0).fill("NovaSenhaSegura123");
    await page.locator('input[type="password"]').nth(1).fill("NovaSenhaSegura123");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();

    await expect(page).toHaveURL("http://127.0.0.1:3001/");
  });

  test("deve exibir erro de credenciais inválidas sem sair da tela de login", async ({ page }) => {
    await mockAuthApi(page, async () => ({
      status: 400,
      body: { error: "E-mail ou senha inválidos." },
    }));

    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill("invalido@nexo.local");
    await page.getByLabel("Senha").fill("SenhaErrada123");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.locator(".nexo-auth-feedback.error")).toHaveText("E-mail ou senha inválidos.");
    await expect(page).toHaveURL(/\/entrar$/);
  });
});
