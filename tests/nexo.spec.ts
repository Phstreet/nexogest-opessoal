import { test, expect, type Page } from "@playwright/test";

const session = {
  user: { id: "user-nexo-e2e", email: "teste@nexo.local", user_metadata: { display_name: "Teste NEXO" } },
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

type StoredCollection = { data_key: string; payload: unknown; revision: number; updated_at: string };

async function mockAuthenticatedCloud(page: Page) {
  const collections = new Map<string, StoredCollection>();

  await page.route("**/api/auth", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { session } });
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (body.action === "logout") {
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.fulfill({ json: { session } });
  });

  await page.route("**/api/sync", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { data: [...collections.values()] } });
      return;
    }

    const body = route.request().postDataJSON() as {
      data_key: string;
      payload: unknown;
      expected_revision: number;
    };
    const current = collections.get(body.data_key);
    const currentRevision = current?.revision ?? 0;
    if (body.expected_revision !== currentRevision) {
      await route.fulfill({
        json: { result: { saved: false, current_revision: current?.revision ?? null, current_updated_at: current?.updated_at ?? null } },
      });
      return;
    }

    const updated: StoredCollection = {
      data_key: body.data_key,
      payload: body.payload,
      revision: currentRevision + 1,
      updated_at: new Date().toISOString(),
    };
    collections.set(body.data_key, updated);
    await route.fulfill({
      json: { result: { saved: true, current_revision: updated.revision, current_updated_at: updated.updated_at } },
    });
  });

  return collections;
}

const appRoutes = [
  "/",
  "/configuracoes",
  "/perfil",
  "/financeiro",
  "/financeiro/dashboard",
  "/financeiro/contas",
  "/financeiro/contas-a-pagar",
  "/financeiro/contas-a-receber",
  "/financeiro/historico",
  "/financeiro/investimentos",
  "/financeiro/reservas",
  "/financeiro/planejamento",
  "/relatorios",
  "/rotina",
  "/rotina/agenda",
  "/rotina/tarefas",
  "/rotina/habitos",
  "/rotina/planejamento",
  "/rotina/produtividade",
];

test.describe("NEXO - Navegação e carregamento autenticado", () => {
  for (const route of appRoutes) {
    test(`deve carregar ${route} sem erro de execução`, async ({ page }) => {
      await mockAuthenticatedCloud(page);
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      const response = await page.goto(route);
      expect(response, `A rota ${route} não retornou uma resposta`).not.toBeNull();
      expect(response!.status()).toBeLessThan(400);
      await expect(page.locator("h1, h2").first()).toBeVisible();
      expect(pageErrors).toEqual([]);
    });
  }
});

test.describe("NEXO - Persistência exclusiva na nuvem", () => {
  test("deve cadastrar uma conta e persistir a coleção no endpoint remoto", async ({ page }) => {
    const cloud = await mockAuthenticatedCloud(page);
    await page.goto("/financeiro/contas");

    await page.getByLabel("Nome da conta").fill("Conta de teste NEXO");
    await page.getByLabel("Banco / Instituição").selectOption({ label: "Nubank" });
    await page.getByLabel("Tipo de conta").selectOption({ label: "Conta corrente" });
    await page.getByLabel("Saldo inicial (R$)").fill("1500,00");
    await page.getByRole("button", { name: "Cadastrar conta" }).click();

    await expect(page.getByText("Conta de teste NEXO")).toBeVisible();
    await expect.poll(() => cloud.get("nexo_accounts")?.revision).toBe(1);
    expect(cloud.get("nexo_accounts")?.payload).toEqual([
      expect.objectContaining({ name: "Conta de teste NEXO", initialBalance: 1500, active: true }),
    ]);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("nexo_")))).toEqual([]);
  });

  test("deve recuperar a conta da nuvem após atualizar a página", async ({ page }) => {
    const cloud = await mockAuthenticatedCloud(page);
    cloud.set("nexo_accounts", {
      data_key: "nexo_accounts",
      payload: [{
        id: 1,
        name: "Conta persistida na nuvem",
        institution: "Nubank",
        type: "Conta corrente",
        initialBalance: 500,
        createdAt: new Date().toISOString(),
        active: true,
        isPrimary: true,
      }],
      revision: 1,
      updated_at: new Date().toISOString(),
    });

    await page.goto("/financeiro/contas");
    await expect(page.getByText("Conta persistida na nuvem")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Conta persistida na nuvem")).toBeVisible();
  });

  test("deve cadastrar uma tarefa e enviar a coleção para a nuvem", async ({ page }) => {
    const cloud = await mockAuthenticatedCloud(page);
    await page.goto("/rotina/tarefas");

    await page.getByRole("button", { name: /Nova tarefa/ }).click();
    await page.getByLabel("Descrição da tarefa *").fill("Tarefa automatizada NEXO");
    await page.getByRole("button", { name: "Cadastrar tarefa" }).click();

    await expect(page.getByText("Tarefa automatizada NEXO")).toBeVisible();
    await expect.poll(() => cloud.get("nexo_tasks")?.revision).toBe(1);
    expect(cloud.get("nexo_tasks")?.payload).toEqual([
      expect.objectContaining({ description: "Tarefa automatizada NEXO" }),
    ]);
  });

  test("deve bloquear a gravação quando o endpoint remoto falhar", async ({ page }) => {
    await mockAuthenticatedCloud(page);
    await page.route("**/api/sync", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { data: [] } });
        return;
      }
      await route.fulfill({ status: 503, json: { error: "Supabase indisponível para teste." } });
    });

    await page.goto("/financeiro/contas");
    await page.getByLabel("Nome da conta").fill("Conta não salva");
    await page.getByLabel("Saldo inicial (R$)").fill("100");
    await page.getByRole("button", { name: "Cadastrar conta" }).click();

    await expect(page.getByText("Conta não salva")).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("nexo_")))).toEqual([]);
  });
});
