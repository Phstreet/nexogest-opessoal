import { test, expect } from "@playwright/test";

const financePages = [
  "/financeiro",
  "/financeiro/dashboard",
  "/financeiro/contas",
  "/financeiro/contas-a-pagar",
  "/financeiro/contas-a-receber",
  "/financeiro/historico",
  "/financeiro/investimentos",
  "/financeiro/reservas",
  "/financeiro/planejamento"
];

const routinePages = [
  "/rotina",
  "/rotina/agenda",
  "/rotina/tarefas",
  "/rotina/habitos",
  "/rotina/planejamento",
  "/rotina/produtividade"
];

// Cada teste recebe um contexto isolado do navegador pelo Playwright.
// Portanto, não é necessário limpar o localStorage navegando pela página inicial.

test.describe("NEXO - Navegação e carregamento", () => {
  for (const route of [...financePages, ...routinePages]) {
    test(`deve carregar ${route} sem erro de execução`, async ({ page }) => {
      const pageErrors: string[] = [];

      page.on("pageerror", (error) => {
        pageErrors.push(error.message);
      });

      const response = await page.goto(route);

      expect(response, `A rota ${route} não retornou uma resposta`).not.toBeNull();
      expect(response!.status()).toBeLessThan(400);

      await expect(page.locator("h1, h2").first()).toBeVisible();

      expect(pageErrors).toEqual([]);
    });
  }
});

test.describe("Financeiro - Cadastro de contas", () => {
  test("deve cadastrar uma conta e salvar no armazenamento", async ({ page }) => {
    await page.goto("/financeiro/contas");

    await page.getByLabel("Nome da conta").fill("Conta de teste NEXO");
    await page.getByLabel("Banco / Instituição").selectOption({ label: "Nubank" });
    await page.getByLabel("Tipo de conta").selectOption({ label: "Conta corrente" });
    await page.getByLabel("Saldo inicial (R$)").fill("1500,00");

    await page.getByRole("button", { name: "Cadastrar conta" }).click();

    await expect(page.getByText("Conta de teste NEXO")).toBeVisible();

    const savedAccounts = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("nexo_accounts") || "[]");
    });

    expect(savedAccounts).toHaveLength(1);
    expect(savedAccounts[0].name).toBe("Conta de teste NEXO");
    expect(savedAccounts[0].initialBalance).toBe(1500);
  });

  test("deve manter a conta após atualizar a página", async ({ page }) => {
    await page.goto("/financeiro/contas");

    await page.getByLabel("Nome da conta").fill("Conta persistente");
    await page.getByLabel("Saldo inicial (R$)").fill("500");

    await page.getByRole("button", { name: "Cadastrar conta" }).click();
    await expect(page.getByText("Conta persistente")).toBeVisible();

    await page.reload();

    await expect(page.getByText("Conta persistente")).toBeVisible();
  });

  test("deve desativar uma conta sem excluí-la", async ({ page }) => {
    await page.goto("/financeiro/contas");

    await page.getByLabel("Nome da conta").fill("Conta para desativar");
    await page.getByLabel("Saldo inicial (R$)").fill("800");
    await page.getByRole("button", { name: "Cadastrar conta" }).click();

    const accountItem = page.locator(".accounts-item").filter({
      hasText: "Conta para desativar"
    });

    await expect(accountItem).toBeVisible();
    await accountItem.getByRole("button", { name: "Desativar", exact: true }).click();

    await expect(accountItem.getByText("Inativa")).toBeVisible();
    await expect(
      accountItem.getByRole("button", { name: "Ativar", exact: true })
    ).toBeVisible();

    const savedAccounts = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("nexo_accounts") || "[]");
    });

    expect(savedAccounts).toHaveLength(1);
    expect(savedAccounts[0].name).toBe("Conta para desativar");
    expect(savedAccounts[0].active).toBe(false);
  });

  test("deve excluir uma conta somente após confirmação", async ({ page }) => {
    await page.goto("/financeiro/contas");

    await page.getByLabel("Nome da conta").fill("Conta para excluir");
    await page.getByLabel("Saldo inicial (R$)").fill("250");
    await page.getByRole("button", { name: "Cadastrar conta" }).click();

    const accountItem = page.locator(".accounts-item").filter({
      hasText: "Conta para excluir"
    });

    await expect(accountItem).toBeVisible();

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("excluir definitivamente");
      await dialog.accept();
    });

    await accountItem.getByRole("button", {
      name: "Excluir conta Conta para excluir"
    }).click();

    await expect(accountItem).toHaveCount(0);

    const savedAccounts = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("nexo_accounts") || "[]");
    });

    expect(savedAccounts).toHaveLength(0);
  });
});

test.describe("Financeiro - Integração de contas e transferências", () => {
  test("deve disponibilizar contas cadastradas no formulário de lançamentos", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "nexo_accounts",
        JSON.stringify([
          {
            id: 91001,
            name: "Conta principal NEXO",
            institution: "Nubank",
            type: "Conta corrente",
            initialBalance: 1200,
            createdAt: "2026-11-16",
            active: true
          }
        ])
      );
    });

    await page.goto("/financeiro");

    const accountField = page
      .locator(".finance-field")
      .filter({ hasText: "Conta financeira" })
      .locator("select");

    await expect(accountField).toHaveValue("Conta principal NEXO");
    await expect(
      accountField.locator('option[value="Conta principal NEXO"]')
    ).toHaveCount(1);
  });

  test("deve registrar uma transferência efetivada entre contas cadastradas", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "nexo_accounts",
        JSON.stringify([
          {
            id: 91002,
            name: "Conta de origem NEXO",
            institution: "Nubank",
            type: "Conta corrente",
            initialBalance: 1500,
            createdAt: "2026-11-16",
            active: true
          },
          {
            id: 91003,
            name: "Conta de destino NEXO",
            institution: "Banco Inter",
            type: "Conta corrente",
            initialBalance: 300,
            createdAt: "2026-11-16",
            active: true
          }
        ])
      );
    });

    await page.goto("/financeiro");

    await page
      .locator(".finance-field")
      .filter({ hasText: "Tipo" })
      .locator("select")
      .selectOption({ label: "Transferência" });

    await page.locator(".field-description input").fill("Transferência entre minhas contas");
    await page
      .locator(".finance-field")
      .filter({ hasText: "Valor (R$)" })
      .locator("input")
      .fill("250,00");

    await page
      .locator(".finance-field")
      .filter({
        has: page.locator("label", { hasText: /^Conta de origem$/ })
      })
      .locator("select")
      .selectOption({ label: "Conta de origem NEXO" });

    await page
      .locator(".finance-field")
      .filter({
        has: page.locator("label", { hasText: /^Conta de destino$/ })
      })
      .locator("select")
      .selectOption({ label: "Conta de destino NEXO" });

    await page
      .locator(".finance-field")
      .filter({ hasText: "Status" })
      .locator("select")
      .selectOption({ label: "Realizada" });

    await page.getByRole("button", { name: "Adicionar lançamento" }).click();

    await expect.poll(
      () => page.evaluate(() => {
        const transactions = JSON.parse(
          localStorage.getItem("nexo_transactions") || "[]"
        );

        return transactions.some((item: {
          type: string;
          description: string;
          amount: number;
          account: string;
          destinationAccount: string;
          status: string;
        }) =>
          item.type === "Transferência" &&
          item.description === "Transferência entre minhas contas" &&
          item.amount === 250 &&
          item.account === "Conta de origem NEXO" &&
          item.destinationAccount === "Conta de destino NEXO" &&
          item.status === "Realizada"
        );
      }),
      {
        message: "A transferência efetivada deve ser salva com origem, destino, valor e status corretos."
      }
    ).toBe(true);
  });
});

test.describe("Rotina - Cadastro de tarefas", () => {
  test("deve cadastrar uma tarefa", async ({ page }) => {
    await page.goto("/rotina/tarefas");

    await page.getByRole("button", { name: /Nova tarefa/ }).click();

    await page.getByLabel("Descrição da tarefa *").fill("Tarefa automatizada NEXO");

    await page.getByRole("button", { name: "Cadastrar tarefa" }).click();
    await expect(page.getByText("Tarefa automatizada NEXO")).toBeVisible();

    const savedTasks = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("nexo_tasks") || "[]");
    });

    expect(
      savedTasks.some(
        (task: { description: string }) =>
          task.description === "Tarefa automatizada NEXO"
      )
    ).toBeTruthy();
  });

  test("deve preservar a tarefa após atualizar a página", async ({ page }) => {
    await page.goto("/rotina/tarefas");

    await page.getByRole("button", { name: /Nova tarefa/ }).click();
    await page.getByLabel("Descrição da tarefa *").fill("Tarefa persistente");

    await page.getByRole("button", { name: "Cadastrar tarefa" }).click();
    await expect(page.getByText("Tarefa persistente")).toBeVisible();

    await page.reload();

    await expect(page.getByText("Tarefa persistente")).toBeVisible();
  });
});

test.describe("Rotina - Cadastro de hábitos", () => {
  test("deve cadastrar um hábito", async ({ page }) => {
    await page.goto("/rotina/habitos");

    await page.getByRole("button", { name: /Novo hábito/ }).click();
    await expect(page.locator("#habit-form")).toBeVisible();

    await page.locator("#habit-name").fill("Hábito automatizado NEXO");

    await page.getByRole("button", { name: "Cadastrar hábito" }).click();
    await expect(page.getByText("Hábito automatizado NEXO")).toBeVisible();

    const savedHabits = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("nexo_habits") || "[]");
    });

    expect(
      savedHabits.some(
        (habit: { name: string }) =>
          habit.name === "Hábito automatizado NEXO"
      )
    ).toBeTruthy();
  });

  test("deve manter o hábito após atualizar a página", async ({ page }) => {
    await page.goto("/rotina/habitos");

    await page.getByRole("button", { name: /Novo hábito/ }).click();
    await expect(page.locator("#habit-form")).toBeVisible();

    await page.locator("#habit-name").fill("Hábito persistente");

    await page.getByRole("button", { name: "Cadastrar hábito" }).click();
    await expect(page.getByText("Hábito persistente")).toBeVisible();

    await page.reload();

    await expect(page.getByText("Hábito persistente")).toBeVisible();
  });
});

test.describe("Financeiro - Pagamentos e recebimentos parciais", () => {
  test("deve calcular corretamente o saldo restante de uma despesa parcialmente paga", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("nexo_transactions", JSON.stringify([{
        id: 92001,
        type: "Despesa",
        description: "Despesa parcialmente paga",
        amount: 1000,
        settledAmount: 400,
        date: "2026-12-20",
        category: "Moradia",
        status: "Paga parcialmente"
      }]));
    });

    await page.goto("/financeiro/contas-a-pagar");

    await expect(page.getByText(/600,00/).first()).toBeVisible();
    await expect(page.getByText(/Pago:/)).toBeVisible();
    await expect(page.getByText("Paga parcialmente")).toBeVisible();
  });

  test("deve calcular corretamente o saldo restante de uma receita parcialmente recebida", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("nexo_transactions", JSON.stringify([{
        id: 92002,
        type: "Receita",
        description: "Receita parcialmente recebida",
        amount: 1000,
        settledAmount: 400,
        date: "2026-12-20",
        category: "Serviços",
        status: "Recebida parcialmente"
      }]));
    });

    await page.goto("/financeiro/contas-a-receber");

    await expect(page.getByText(/600,00/).first()).toBeVisible();
    await expect(page.getByText(/Recebido:/)).toBeVisible();
    await expect(page.getByText("Recebida parcialmente")).toBeVisible();
  });

  test("deve registrar pagamento parcial pela tela de contas a pagar", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("nexo_transactions", JSON.stringify([{
        id: 92003,
        type: "Despesa",
        description: "Pagamento parcial pela interface",
        amount: 1000,
        date: "2026-12-20",
        category: "Moradia",
        status: "Pendente"
      }]));
    });

    await page.goto("/financeiro/contas-a-pagar");
    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("prompt");
      await dialog.accept("400,00");
    });
    await page.getByRole("button", { name: "Registrar pagamento parcial" }).click();

    await expect(page.getByText(/Pago:/)).toBeVisible();
    await expect(page.getByText(/600,00/).first()).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nexo_transactions") || "[]"));
    expect(saved[0]).toMatchObject({ settledAmount: 400, status: "Paga parcialmente" });
  });

  test("deve registrar recebimento parcial pela tela de contas a receber", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("nexo_transactions", JSON.stringify([{
        id: 92004,
        type: "Receita",
        description: "Recebimento parcial pela interface",
        amount: 1000,
        date: "2026-12-20",
        category: "Serviços",
        status: "Pendente"
      }]));
    });

    await page.goto("/financeiro/contas-a-receber");
    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("prompt");
      await dialog.accept("400,00");
    });
    await page.getByRole("button", { name: "Registrar recebimento parcial" }).click();

    await expect(page.getByText(/Recebido:/)).toBeVisible();
    await expect(page.getByText(/600,00/).first()).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nexo_transactions") || "[]"));
    expect(saved[0]).toMatchObject({ settledAmount: 400, status: "Recebida parcialmente" });
  });

  test("deve exibir o saldo atualizado da conta, e não somente o saldo inicial", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("nexo_accounts", JSON.stringify([{
        id: 92005,
        name: "Conta com movimentação",
        institution: "Nubank",
        type: "Conta corrente",
        initialBalance: 1000,
        createdAt: "2026-11-16",
        active: true
      }]));
      localStorage.setItem("nexo_transactions", JSON.stringify([{
        id: 92006,
        type: "Despesa",
        description: "Despesa já paga",
        amount: 250,
        settledAmount: 250,
        account: "Conta com movimentação",
        date: "2026-11-16",
        status: "Pago"
      }]));
    });

    await page.goto("/financeiro/contas");
    const account = page.locator(".accounts-item").filter({ hasText: "Conta com movimentação" });
    await expect(account.getByText("Saldo atual")).toBeVisible();
    await expect(account.getByText(/750,00/)).toBeVisible();
  });

  test("deve refletir somente o valor parcialmente pago no saldo da conta", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("nexo_accounts", JSON.stringify([{
        id: 92009,
        name: "Conta pagamento parcial",
        institution: "Banco",
        type: "Conta corrente",
        initialBalance: 1000,
        createdAt: "2026-11-16",
        active: true
      }]));
      localStorage.setItem("nexo_transactions", JSON.stringify([{
        id: 92010,
        type: "Despesa",
        description: "Despesa parcialmente paga",
        amount: 500,
        settledAmount: 200,
        account: "Conta pagamento parcial",
        date: "2026-11-16",
        status: "Paga parcialmente"
      }]));
    });

    await page.goto("/financeiro/contas");
    const account = page.locator(".accounts-item").filter({ hasText: "Conta pagamento parcial" });
    await expect(account.getByText(/800,00/)).toBeVisible();
  });

  test("deve aplicar a alteração do saldo inicial ao editar uma reserva", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("nexo_reserves", JSON.stringify([{
        id: 92007,
        name: "Reserva editável",
        category: "Emergência",
        description: "",
        targetAmount: 2000,
        initialBalance: 500,
        monthlyContribution: 100,
        startDate: "2026-11-01",
        targetDate: "",
        accountId: null,
        institution: "",
        status: "Ativa",
        createdAt: "2026-11-16"
      }]));
      localStorage.setItem("nexo_reserve_movements", JSON.stringify([{
        id: 92008,
        reserveId: 92007,
        type: "Aporte",
        amount: 150,
        date: "2026-11-16",
        description: "Aporte anterior",
        createdAt: "2026-11-16"
      }]));
    });

    await page.goto("/financeiro/reservas");
    const reserve = page.locator(".reserve-card").filter({ hasText: "Reserva editável" });
    await reserve.getByRole("button", { name: "Editar" }).click();
    await page.locator("#reserve-initial").fill("700");
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(reserve.getByText(/850,00/)).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nexo_reserves") || "[]"));
    expect(saved[0].initialBalance).toBe(700);
  });

});

test.describe("Financeiro - Proteção de vínculos e Dashboard", () => {
  test("não deve permitir excluir conta com movimentações vinculadas", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("nexo_accounts", JSON.stringify([{
        id: 93001,
        name: "Conta vinculada",
        institution: "Nubank",
        type: "Conta corrente",
        initialBalance: 1000,
        createdAt: "2026-11-16",
        active: true
      }]));
      localStorage.setItem("nexo_transactions", JSON.stringify([{
        id: 93002,
        type: "Despesa",
        description: "Despesa vinculada",
        amount: 100,
        account: "Conta vinculada",
        status: "Pago"
      }]));
    });

    await page.goto("/financeiro/contas");
    const accountItem = page.locator(".accounts-item").filter({ hasText: "Conta vinculada" });
    await expect(accountItem).toBeVisible();

    page.on("dialog", async (dialog) => {
      if (dialog.type() === "confirm") {
        await dialog.accept();
      } else {
        expect(dialog.message()).toContain("movimentações ou reservas vinculadas");
        await dialog.accept();
      }
    });
    await accountItem.getByRole("button", { name: "Excluir conta Conta vinculada" }).click();

    await expect(accountItem).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nexo_accounts") || "[]"));
    expect(saved).toHaveLength(1);
  });

  test("deve calcular o resultado mensal somente com movimentações efetivadas", async ({ page }) => {
    await page.addInitScript(() => {
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      localStorage.setItem("nexo_transactions", JSON.stringify([
        { id: 93101, type: "Receita", description: "Receita confirmada", amount: 500, settledAmount: 500, date, status: "Recebida" },
        { id: 93102, type: "Despesa", description: "Despesa confirmada", amount: 200, settledAmount: 200, date, status: "Pago" },
        { id: 93103, type: "Despesa", description: "Despesa pendente", amount: 1000, date, status: "Pendente" },
        { id: 93104, type: "Investimento", description: "Investimento pendente", amount: 300, date, status: "Pendente" },
        { id: 93105, type: "Reserva", description: "Reserva pendente", amount: 400, date, status: "Pendente" }
      ]));
    });

    await page.goto("/financeiro/dashboard");
    const resultCard = page.locator(".summary-card").filter({ hasText: "Resultado do mês" });
    await expect(resultCard).toBeVisible();
    await expect(resultCard.getByText(/300,00/)).toBeVisible();
  });

  test("deve apresentar no Dashboard o saldo real das reservas", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("nexo_accounts", JSON.stringify([{
        id: 93011,
        name: "Conta do Dashboard",
        institution: "Nubank",
        type: "Conta corrente",
        initialBalance: 1000,
        createdAt: "2026-11-16",
        active: true
      }]));
      localStorage.setItem("nexo_transactions", JSON.stringify([{
        id: 93012,
        type: "Despesa",
        description: "Despesa paga",
        amount: 100,
        settledAmount: 100,
        account: "Conta do Dashboard",
        status: "Pago",
        date: "2026-11-16"
      }]));
      localStorage.setItem("nexo_reserves", JSON.stringify([{
        id: 93013,
        name: "Reserva de emergência",
        category: "Emergência",
        description: "",
        targetAmount: 2000,
        initialBalance: 500,
        monthlyContribution: 100,
        startDate: "2026-11-01",
        targetDate: "",
        accountId: 93011,
        institution: "Nubank",
        status: "Ativa",
        createdAt: "2026-11-16"
      }]));
      localStorage.setItem("nexo_reserve_movements", JSON.stringify([{
        id: 93014,
        reserveId: 93013,
        type: "Aporte",
        amount: 150,
        date: "2026-11-16",
        description: "Aporte de teste",
        createdAt: "2026-11-16"
      }]));
    });

    await page.goto("/financeiro/dashboard");
    const accountsPanel = page.locator(".account-panel");
    await expect(accountsPanel.getByText("Saldo total das reservas ativas")).toBeVisible();
    await expect(accountsPanel.getByText(/650,00/)).toBeVisible();
    await expect(accountsPanel.getByText(/900,00/).first()).toBeVisible();
  });
});

test.describe("Financeiro - Proteção de dados", () => {
  test("deve carregar a página financeira sem erro de JavaScript", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/financeiro");
    await expect(page.locator("h1, h2").first()).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("deve preservar os lançamentos válidos existentes", async ({ page }) => {
    const testTransaction = {
      id: 999001,
      type: "Receita",
      description: "Lançamento de teste",
      amount: 100,
      date: "2026-11-16",
      category: "Salário",
      status: "Recebida"
    };

    await page.addInitScript((transaction) => {
      localStorage.setItem("nexo_transactions", JSON.stringify([transaction]));
    }, testTransaction);

    await page.goto("/financeiro");

    await expect(page.getByText("Lançamento de teste")).toBeVisible();

    await expect.poll(
      () =>
        page.evaluate(() => {
          const saved = JSON.parse(
            localStorage.getItem("nexo_transactions") || "[]"
          );

          return (
            Array.isArray(saved) &&
            saved.some((item: { id: number }) => item.id === 999001)
          );
        }),
      {
        message: "O lançamento válido deve permanecer no LocalStorage após o carregamento."
      }
    ).toBe(true);
  });
});
