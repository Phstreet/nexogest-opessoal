import { test, expect, type Page } from "@playwright/test";
import { getSaoPauloDateKey } from "../lib/utils/date";

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

  await page.route("**/api/sync**", async (route) => {
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
  "/rotina/metas",
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

  test("deve respeitar a meta semanal de hábitos com frequência de três vezes", async ({ page }) => {
    const cloud = await mockAuthenticatedCloud(page);
    await page.goto("/rotina/habitos");

    await page.getByRole("button", { name: /Novo hábito/ }).click();
    await page.getByLabel("Nome do hábito *").fill("Leitura de teste");
    await page.getByLabel("Frequência").selectOption("3 vezes por semana");
    await page.getByRole("button", { name: "Cadastrar hábito" }).click();

    await expect(page.getByText("Semana: 0/3")).toBeVisible();
    await expect.poll(() => cloud.get("nexo_habits")?.revision).toBe(1);
    expect(cloud.get("nexo_habits")?.payload).toEqual([
      expect.objectContaining({
        name: "Leitura de teste",
        frequency: "3 vezes por semana",
      }),
    ]);

    await page.getByRole("button", { name: "Marcar hábito como concluído" }).click();
    await expect(page.getByRole("button", { name: "Desmarcar hábito" })).toBeVisible();
    await expect.poll(() => cloud.get("nexo_habits")?.revision).toBe(2);
    expect(cloud.get("nexo_habits")?.payload).toEqual([
      expect.objectContaining({
        name: "Leitura de teste",
        completedDates: [getSaoPauloDateKey()],
      }),
    ]);
  });

  test("deve bloquear a gravação quando o endpoint remoto falhar", async ({ page }) => {
    await mockAuthenticatedCloud(page);
    await page.route("**/api/sync**", async (route) => {
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


test.describe("NEXO - Objetivos pessoais", () => {
  test("deve cadastrar objetivo numérico de redução e persistir no Supabase", async ({ page }) => {
    const cloud = await mockAuthenticatedCloud(page);
    await page.goto("/rotina/metas");

    await expect(page.getByRole("heading", { name: "Meus objetivos" })).toBeVisible();
    await page.getByRole("button", { name: "Novo objetivo" }).click();
    await page.getByLabel("Nome do objetivo *").fill("Reduzir medida de teste");
    await page.getByLabel("Direção do objetivo").selectOption("decrease");
    await page.getByLabel("Unidade").selectOption("kg");
    await page.getByLabel("Valor inicial").fill("100");
    await page.getByLabel("Valor desejado").fill("90");
    await page.getByLabel("Valor atual").fill("95");
    await page.getByRole("button", { name: "Criar objetivo" }).click();

    await expect(page.getByRole("heading", { name: "Reduzir medida de teste" })).toBeVisible();
    await expect.poll(() => cloud.get("nexo_personal_goals")?.revision).toBe(1);
    expect(cloud.get("nexo_personal_goals")?.payload).toEqual([
      expect.objectContaining({
        title: "Reduzir medida de teste",
        trackingType: "numeric",
        direction: "decrease",
        startValue: 100,
        target: 90,
        current: 95,
      }),
    ]);
  });

  test("deve cadastrar objetivo por etapas e salvar novas etapas na nuvem", async ({ page }) => {
    const cloud = await mockAuthenticatedCloud(page);
    await page.goto("/rotina/metas");

    await page.getByRole("button", { name: "Novo objetivo" }).click();
    await page.getByLabel("Nome do objetivo *").fill("Concluir curso de teste");
    await page.getByLabel("Forma de acompanhamento").selectOption("steps");
    await page.getByRole("button", { name: "Criar objetivo" }).click();

    await expect(page.getByRole("heading", { name: "Concluir curso de teste" })).toBeVisible();
    await page.getByPlaceholder("Adicionar uma etapa...").fill("Concluir primeiro módulo");
    await page.getByRole("button", { name: "Adicionar etapa" }).click();

    await expect(page.getByText("Concluir primeiro módulo")).toBeVisible();
    await expect.poll(() => {
      const payload = cloud.get("nexo_personal_goals")?.payload as Array<{ steps?: Array<{ title: string }> }> | undefined;
      return payload?.[0]?.steps?.length;
    }).toBe(1);
    expect((cloud.get("nexo_personal_goals")?.payload as Array<{ steps: Array<{ title: string }> }>)[0].steps[0].title)
      .toBe("Concluir primeiro módulo");
  });

  test("deve registrar frequência semanal sem duplicar o registro do mesmo dia", async ({ page }) => {
    const cloud = await mockAuthenticatedCloud(page);
    await page.goto("/rotina/metas");

    await page.getByRole("button", { name: "Novo objetivo" }).click();
    await page.getByLabel("Nome do objetivo *").fill("Estudar inglês");
    await page.getByLabel("Forma de acompanhamento").selectOption("frequency");
    await page.getByLabel("Quantas vezes por semana?").fill("5");
    await page.getByRole("button", { name: "Criar objetivo" }).click();

    await expect(page.getByRole("heading", { name: "Estudar inglês" })).toBeVisible();
    await page.getByRole("button", { name: "Registrar atividade de hoje" }).click();

    await expect(page.getByRole("button", { name: "Registrado hoje" })).toBeVisible();
    await expect.poll(() => {
      const payload = cloud.get("nexo_personal_goals")?.payload as Array<{ frequencyLogs?: string[] }> | undefined;
      return payload?.[0]?.frequencyLogs?.length;
    }).toBe(1);
  });
});


test.describe("NEXO - Operações financeiras", () => {
  test("deve cadastrar, editar, liquidar parcialmente, concluir e excluir um lançamento", async ({ page }) => {
    const cloud = await mockAuthenticatedCloud(page);
    await page.goto("/financeiro");

    await expect(page.locator(".finance-sync-status")).toContainText(
      "Dados carregados diretamente do Supabase"
    );

    await page.locator(".finance-form input").nth(0).fill("Despesa automatizada");
    await page.locator(".finance-form input[placeholder='0,00']").first().fill("100,00");
    await page.getByRole("button", { name: /Adicionar lançamento/ }).click();

    await expect(page.getByText("Despesa automatizada")).toBeVisible();
    await expect.poll(() => cloud.get("nexo_transactions")?.revision).toBe(1);

    let movement = page.locator(".finance-item").filter({ hasText: "Despesa automatizada" });
    await movement.getByRole("button", { name: /Editar/ }).click();
    await expect(page.getByRole("heading", { name: "Editar lançamento" })).toBeVisible();
    await page.locator(".finance-form input").nth(0).fill("Despesa automatizada editada");
    await page.locator(".finance-form input[placeholder='0,00']").first().fill("120,00");
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page.getByText("Despesa automatizada editada")).toBeVisible();
    await expect.poll(() => cloud.get("nexo_transactions")?.revision).toBe(2);

    movement = page.locator(".finance-item").filter({ hasText: "Despesa automatizada editada" });
    await movement.getByRole("button", { name: "Informar valor pago" }).click();
    await movement.getByRole("textbox", { name: "Valor pago" }).fill("35,00");
    await movement.getByRole("button", { name: "Confirmar" }).click();

    await expect(movement).toContainText("Paga parcialmente");
    await expect.poll(() => cloud.get("nexo_transactions")?.revision).toBe(3);
    expect(cloud.get("nexo_transactions")?.payload).toEqual([
      expect.objectContaining({
        description: "Despesa automatizada editada",
        amount: 120,
        settledAmount: 35,
        status: "Paga parcialmente",
      }),
    ]);

    movement = page.locator(".finance-item").filter({ hasText: "Despesa automatizada editada" });
    await movement.getByRole("button", { name: "Informar valor pago" }).click();
    await movement.getByRole("textbox", { name: "Valor pago" }).fill("120,00");
    await movement.getByRole("button", { name: "Confirmar" }).click();

    await expect(movement).toContainText("Pago");
    await expect.poll(() => cloud.get("nexo_transactions")?.revision).toBe(4);

    movement = page.locator(".finance-item").filter({ hasText: "Despesa automatizada editada" });
    await movement.getByRole("button", { name: "Excluir Despesa automatizada editada" }).click();
    await page.getByRole("button", { name: "Excluir", exact: true }).click();

    await expect(page.getByText("Despesa automatizada editada")).toHaveCount(0);
    await expect.poll(() => cloud.get("nexo_transactions")?.revision).toBe(5);
    expect(cloud.get("nexo_transactions")?.payload).toEqual([]);
  });

  test("deve expandir recorrência mensal sem duplicar ocorrências ao recarregar", async ({ page }) => {
    const cloud = await mockAuthenticatedCloud(page);
    await page.goto("/financeiro");

    await expect(page.locator(".finance-sync-status")).toContainText(
      "Dados carregados diretamente do Supabase"
    );

    await page.locator(".finance-form input").nth(0).fill("Aluguel recorrente de teste");
    await page.locator(".finance-form input[placeholder='0,00']").first().fill("1500,00");
    await page.locator(".finance-form select").nth(6).selectOption("Mensal");
    await page.getByRole("button", { name: /Adicionar lançamento/ }).click();

    await expect.poll(() => {
      const payload = cloud.get("nexo_transactions")?.payload as unknown[] | undefined;
      return payload?.length;
    }).toBe(13);
    await expect.poll(() => cloud.get("nexo_transactions")?.revision).toBe(1);

    await page.reload();
    await expect(page.locator(".finance-item")).toHaveCount(13);
    expect((cloud.get("nexo_transactions")?.payload as unknown[]).length).toBe(13);
    expect(cloud.get("nexo_transactions")?.revision).toBe(1);
  });
});

test.describe("NEXO - Contas a pagar", () => {
  test("preserva pagamentos em centavos e mantém o status de conta cancelada", async ({ page }) => {
    const cloud = await mockAuthenticatedCloud(page);
    cloud.set("nexo_accounts", {
      data_key: "nexo_accounts",
      payload: [{
        id: 1,
        name: "Conta principal de teste",
        institution: "Nubank",
        type: "Conta corrente",
        initialBalance: 1000,
        createdAt: new Date().toISOString(),
        active: true,
        isPrimary: true,
      }],
      revision: 1,
      updated_at: new Date().toISOString(),
    });

    await page.goto("/financeiro/contas-a-pagar");
    await page.getByRole("button", { name: "Nova despesa" }).click();
    await page.getByLabel("Descrição").fill("Fatura de teste");
    await page.getByLabel("Valor total").fill("0,30");
    await page.getByLabel("Valor já pago").fill("0,10");
    await page.getByLabel("Conta de pagamento").selectOption("Conta principal de teste");
    await page.getByRole("button", { name: "Cadastrar despesa" }).click();

    await expect(page.getByText("Paga parcialmente")).toBeVisible();
    await expect(page.getByText(/Pendente: R\$\s*0,20/)).toBeVisible();
    await expect(page.locator(".payable-summary-card").nth(0)).toContainText("R$ 0,20");
    await expect(page.locator(".payable-summary-card").nth(1)).toContainText("R$ 0,10");
    await expect.poll(() => cloud.get("nexo_transactions")?.revision).toBe(1);

    page.once("dialog", (dialog) => dialog.accept("0,20"));
    await page.getByRole("button", { name: "Registrar pagamento parcial" }).click();
    await expect(page.getByText("Pago", { exact: true })).toBeVisible();
    await expect.poll(() => cloud.get("nexo_transactions")?.revision).toBe(2);

    const expense = page.locator("tr").filter({ hasText: "Fatura de teste" });
    await expense.getByRole("button", { name: "Editar" }).click();
    await page.getByLabel("Status").selectOption("Cancelada");
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
    await expect.poll(() => cloud.get("nexo_transactions")?.revision).toBe(3);
    expect(cloud.get("nexo_transactions")?.payload).toEqual([
      expect.objectContaining({
        description: "Fatura de teste",
        amount: 0.3,
        settledAmount: 0.3,
        status: "Cancelada",
      }),
    ]);
  });
});

test.describe("NEXO - Agenda", () => {
  test("cadastra atividade e persiste a data no calendário compartilhado", async ({ page }) => {
    const cloud = await mockAuthenticatedCloud(page);
    await page.goto("/rotina/agenda");

    await page.getByRole("button", { name: /Nova atividade/ }).click();
    await page.getByLabel("Nome da atividade *").fill("Consulta de teste NEXO");
    await page.getByLabel("Data").fill(getSaoPauloDateKey());
    await page.getByLabel("Horário").fill("10:30");
    await page.getByRole("button", { name: "Cadastrar atividade" }).click();

    await expect(page.getByText("Consulta de teste NEXO")).toBeVisible();
    await expect.poll(() => cloud.get("nexo_tasks")?.revision).toBe(1);
    expect(cloud.get("nexo_tasks")?.payload).toEqual([
      expect.objectContaining({
        description: "Consulta de teste NEXO",
        date: getSaoPauloDateKey(),
        time: "10:30",
      }),
    ]);
  });
});

test.describe("NEXO - Recuperação offline da rotina", () => {
  test("preserva uma atividade da Agenda após falha de rede e sincroniza ao reconectar", async ({ page }) => {
    const cloud = await mockAuthenticatedCloud(page);
    let online = false;

    await page.route("**/api/sync**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { data: [...cloud.values()] } });
        return;
      }

      if (!online) {
        await route.fulfill({ status: 503, json: { error: "Conexão indisponível para teste." } });
        return;
      }

      const body = route.request().postDataJSON() as {
        data_key: string;
        payload: unknown;
        expected_revision: number;
      };
      const current = cloud.get(body.data_key);
      const revision = current?.revision ?? 0;
      if (revision !== body.expected_revision) {
        await route.fulfill({ json: { result: { saved: false, current_revision: revision, current_updated_at: current?.updated_at ?? null } } });
        return;
      }
      const saved: StoredCollection = {
        data_key: body.data_key,
        payload: body.payload,
        revision: revision + 1,
        updated_at: new Date().toISOString(),
      };
      cloud.set(body.data_key, saved);
      await route.fulfill({ json: { result: { saved: true, current_revision: saved.revision, current_updated_at: saved.updated_at } } });
    });

    await page.goto("/rotina/agenda");
    await page.getByRole("button", { name: /Nova atividade/ }).click();
    await page.getByLabel("Nome da atividade *").fill("Atividade offline preservada");
    await page.getByLabel("Data").fill(getSaoPauloDateKey());
    await page.getByRole("button", { name: "Cadastrar atividade" }).click();

    await expect(page.getByText("Atividade offline preservada")).toBeVisible();
    await expect(page.locator(".routine-sync-warning")).toContainText("guardada neste dispositivo");

    await page.reload();
    await expect(page.getByText("Atividade offline preservada")).toBeVisible();
    await expect(page.locator(".routine-sync-warning")).toContainText("guardadas neste dispositivo");

    online = true;
    await page.getByRole("button", { name: "Tentar sincronizar" }).click();
    await expect.poll(() => cloud.get("nexo_tasks")?.revision).toBe(1);
    await expect(page.locator(".routine-sync-warning")).toHaveCount(0);
    expect(cloud.get("nexo_tasks")?.payload).toEqual([
      expect.objectContaining({ description: "Atividade offline preservada" }),
    ]);
  });

  test("preserva backup local e não sobrescreve uma versão remota conflitante", async ({ page }) => {
    const cloud = await mockAuthenticatedCloud(page);
    await page.route("**/api/sync**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { data: [...cloud.values()] } });
        return;
      }
      await route.fulfill({ status: 503, json: { error: "Conexão indisponível para teste." } });
    });

    await page.goto("/rotina/habitos");
    await page.getByRole("button", { name: /Novo hábito/ }).click();
    await page.getByLabel("Nome do hábito *").fill("Minha versão local");
    await page.getByRole("button", { name: "Cadastrar hábito" }).click();
    await expect(page.locator(".routine-sync-warning")).toContainText("guardada neste dispositivo");

    cloud.set("nexo_habits", {
      data_key: "nexo_habits",
      payload: [{
        id: 9902,
        name: "Versão remota de outro dispositivo",
        category: "Pessoal",
        frequency: "Diário",
        completedDates: [],
        active: true,
      }],
      revision: 1,
      updated_at: new Date().toISOString(),
    });

    await page.reload();
    await expect(page.getByText("Minha versão local")).toBeVisible();
    await expect(page.locator(".routine-sync-warning")).toContainText("Conflito de sincronização");

    await page.getByRole("button", { name: "Tentar sincronizar" }).click();
    await expect(page.locator(".routine-sync-warning")).toContainText("Conflito de sincronização");
    expect(cloud.get("nexo_habits")?.revision).toBe(1);
    expect(cloud.get("nexo_habits")?.payload).toEqual([
      expect.objectContaining({ name: "Versão remota de outro dispositivo" }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar backup pendente" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("nexo-backup-nexo_habits-pendente.json");
  });

  test("preserva conclusão de hábito após falha de rede e sincroniza ao reconectar", async ({ page }) => {
    const cloud = await mockAuthenticatedCloud(page);
    let online = false;

    await page.route("**/api/sync**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { data: [...cloud.values()] } });
        return;
      }

      if (!online) {
        await route.fulfill({ status: 503, json: { error: "Conexão indisponível para teste." } });
        return;
      }

      const body = route.request().postDataJSON() as {
        data_key: string;
        payload: unknown;
        expected_revision: number;
      };
      const current = cloud.get(body.data_key);
      const revision = current?.revision ?? 0;
      if (revision !== body.expected_revision) {
        await route.fulfill({ json: { result: { saved: false, current_revision: revision, current_updated_at: current?.updated_at ?? null } } });
        return;
      }
      const saved: StoredCollection = {
        data_key: body.data_key,
        payload: body.payload,
        revision: revision + 1,
        updated_at: new Date().toISOString(),
      };
      cloud.set(body.data_key, saved);
      await route.fulfill({ json: { result: { saved: true, current_revision: saved.revision, current_updated_at: saved.updated_at } } });
    });

    await page.goto("/rotina/habitos");
    await page.getByRole("button", { name: /Novo hábito/ }).click();
    await page.getByLabel("Nome do hábito *").fill("Hábito offline preservado");
    await page.getByRole("button", { name: "Cadastrar hábito" }).click();
    await page.getByRole("button", { name: "Marcar hábito como concluído" }).click();

    await expect(page.locator(".routine-sync-warning")).toContainText("guardada neste dispositivo");
    await page.reload();
    await expect(page.getByText("Hábito offline preservado")).toBeVisible();
    await expect(page.getByRole("button", { name: "Desmarcar hábito" })).toBeVisible();
    await expect(page.locator(".routine-sync-warning")).toContainText("guardadas neste dispositivo");

    online = true;
    await page.getByRole("button", { name: "Tentar sincronizar" }).click();
    await expect.poll(() => cloud.get("nexo_habits")?.revision).toBe(1);
    await expect(page.locator(".routine-sync-warning")).toHaveCount(0);
    expect(cloud.get("nexo_habits")?.payload).toEqual([
      expect.objectContaining({
        name: "Hábito offline preservado",
        completedDates: [getSaoPauloDateKey()],
      }),
    ]);
  });
});

test.describe("NEXO - Fuso horário da Central do Dia", () => {
  test("mantém a data de São Paulo mesmo quando o navegador está em outro fuso", async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:3001",
      timezoneId: "Pacific/Honolulu",
    });
    const page = await context.newPage();
    const cloud = await mockAuthenticatedCloud(page);
    const today = getSaoPauloDateKey();

    cloud.set("nexo_tasks", {
      data_key: "nexo_tasks",
      payload: [{
        id: 9901,
        description: "Compromisso no fuso oficial",
        done: false,
        date: today,
        time: "09:00",
        priority: "Alta",
        category: "Pessoal",
        notes: "",
        createdAt: new Date().toISOString(),
      }],
      revision: 1,
      updated_at: new Date().toISOString(),
    });

    await page.goto("/");
    await expect(page.locator(".daily-agenda-item")).toContainText("Compromisso no fuso oficial");
    await expect(page.locator(".daily-kpis")).toContainText("01");
    await context.close();
  });
});

test.describe("NEXO - Responsividade da Central do Dia", () => {
  test("mantém os cards alinhados e não cria rolagem horizontal nos breakpoints principais", async ({ page }) => {
    await mockAuthenticatedCloud(page);

    for (const width of [360, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.locator(".daily-center")).toBeVisible();
      await expect(page.locator(".daily-kpis .nexo-stat-card")).toHaveCount(4);
      await expect(page.locator(".daily-grid > .daily-card")).toHaveCount(6);

      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
      }));
      expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);

      if (width < 1024) {
        await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
        await expect(page.locator(".sidebar.mobile-open")).toBeVisible();
        await page.getByRole("button", { name: "Fechar menu de navegação" }).click({ position: { x: width - 10, y: 450 } });
        await expect(page.locator(".sidebar.mobile-open")).toHaveCount(0);
      }
    }
  });
});
